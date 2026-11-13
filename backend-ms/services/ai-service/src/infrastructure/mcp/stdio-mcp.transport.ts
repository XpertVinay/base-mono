import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';
import { IMcpTransport } from './mcp-transport.interface.js';
import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse } from './mcp-jsonrpc.types.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: JsonRpcResponse<any>) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export class StdioMcpTransport implements IMcpTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private readonly pending = new Map<string, PendingRequest>();
  private readonly defaultTimeoutMs: number;

  constructor(private readonly options: StdioTransportOptions) {
    this.defaultTimeoutMs = options.timeoutMs || parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '15000', 10);
  }

  private assertCommandAllowed(): void {
    if (process.env.MCP_ALLOW_STDIO === 'false') {
      throw new Error('STDIO MCP transport is disabled by MCP_ALLOW_STDIO=false');
    }

    const allowedRaw = process.env.MCP_STDIO_ALLOWED_COMMANDS || 'node,npx,uvx,python,python3';
    const allowed = new Set(
      allowedRaw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );

    const baseCmd = path.basename(this.options.command);
    if (!allowed.has(this.options.command) && !allowed.has(baseCmd)) {
      throw new Error(
        `STDIO command '${this.options.command}' is not in MCP_STDIO_ALLOWED_COMMANDS (${Array.from(allowed).join(', ')})`
      );
    }
  }

  async connect(): Promise<void> {
    if (this.child && !this.child.killed) return;
    this.assertCommandAllowed();

    const child = spawn(this.options.command, this.options.args || [], {
      cwd: this.options.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(this.options.env || {})
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.child = child;
    this.buffer = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      let newlineIdx: number;
      while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newlineIdx).trim();
        this.buffer = this.buffer.slice(newlineIdx + 1);
        if (!line) continue;
        this.handleLine(line);
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      const msg = chunk.trim();
      if (msg) {
        logger.debug(`MCP STDIO stderr [${this.options.command}]`, { stderr: msg.slice(0, 500) });
      }
    });

    child.on('exit', (code, signal) => {
      const reason = new Error(`MCP STDIO process '${this.options.command}' exited (code=${code}, signal=${signal})`);
      for (const [id, entry] of this.pending.entries()) {
        clearTimeout(entry.timer);
        entry.reject(reason);
        this.pending.delete(id);
      }
      this.child = null;
    });

    child.on('error', (err) => {
      for (const [id, entry] of this.pending.entries()) {
        clearTimeout(entry.timer);
        entry.reject(err);
        this.pending.delete(id);
      }
      this.child = null;
    });
  }

  private handleLine(line: string): void {
    try {
      const msg = JSON.parse(line) as JsonRpcResponse;
      if (msg && msg.id !== undefined && msg.id !== null) {
        const key = String(msg.id);
        const pending = this.pending.get(key);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(key);
          pending.resolve(msg);
        }
      }
    } catch {
      logger.debug('Ignored non-JSON stdout line from MCP STDIO process', { line: line.slice(0, 200) });
    }
  }

  isConnected(): boolean {
    return Boolean(this.child && !this.child.killed && this.child.exitCode === null);
  }

  async sendRequest<T = any>(request: JsonRpcRequest, timeoutMs?: number): Promise<JsonRpcResponse<T>> {
    if (!this.isConnected()) {
      await this.connect();
    }
    if (!this.child) {
      throw new Error('MCP STDIO process is not running');
    }

    const key = String(request.id);
    const effectiveTimeout = timeoutMs || this.defaultTimeoutMs;

    return new Promise<JsonRpcResponse<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(key);
        reject(new Error(`MCP STDIO request '${request.method}' timed out after ${effectiveTimeout}ms`));
      }, effectiveTimeout);

      this.pending.set(key, { resolve, reject, timer });

      const payload = JSON.stringify(request) + '\n';
      this.child!.stdin.write(payload, 'utf8', (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(key);
          reject(err);
        }
      });
    });
  }

  async sendNotification(notification: JsonRpcNotification): Promise<void> {
    if (!this.isConnected() || !this.child) {
      return;
    }
    const payload = JSON.stringify(notification) + '\n';
    await new Promise<void>((resolve, reject) => {
      this.child!.stdin.write(payload, 'utf8', (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('MCP STDIO transport closed'));
      this.pending.delete(id);
    }

    if (this.child && !this.child.killed) {
      const proc = this.child;
      this.child = null;
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
          resolve();
        }, 500);
        proc.once('exit', () => {
          clearTimeout(killTimer);
          resolve();
        });
      });
    }
  }
}

