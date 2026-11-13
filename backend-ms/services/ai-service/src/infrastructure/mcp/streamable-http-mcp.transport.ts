import { IMcpTransport } from './mcp-transport.interface.js';
import { JsonRpcNotification, JsonRpcRequest, JsonRpcResponse, MCP_PROTOCOL_VERSION } from './mcp-jsonrpc.types.js';
import { DecryptedProviderCredentials } from '../../application/ports/mcp-client.port.js';
import { McpAuthType } from '../../shared/contracts/index.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface StreamableHttpTransportOptions {
  endpointUrl: string;
  authType: McpAuthType;
  credentials?: DecryptedProviderCredentials;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
}

export class StreamableHttpMcpTransport implements IMcpTransport {
  private sessionId?: string;
  private connected = false;
  private readonly defaultTimeoutMs: number;

  constructor(private readonly options: StreamableHttpTransportOptions) {
    this.defaultTimeoutMs = options.timeoutMs || parseInt(process.env.MCP_REQUEST_TIMEOUT_MS || '15000', 10);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      ...(this.options.defaultHeaders || {})
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const creds = this.options.credentials;
    if (creds) {
      if (this.options.authType === 'BEARER' && creds.bearerToken) {
        headers['Authorization'] = `Bearer ${creds.bearerToken}`;
      } else if (this.options.authType === 'API_KEY' && creds.apiKey) {
        const hdrName = creds.apiKeyHeader || 'x-api-key';
        headers[hdrName] = creds.apiKey;
      } else if (this.options.authType === 'BASIC' && creds.username) {
        const encoded = Buffer.from(`${creds.username}:${creds.password || ''}`).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
      if (creds.headers) {
        for (const [k, v] of Object.entries(creds.headers)) {
          headers[k] = v;
        }
      }
    }

    return headers;
  }

  async sendRequest<T = any>(request: JsonRpcRequest, timeoutMs?: number): Promise<JsonRpcResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || this.defaultTimeoutMs);

    try {
      const response = await fetch(this.options.endpointUrl, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(request),
        signal: controller.signal
      });

      const returnedSessionId = response.headers.get('mcp-session-id');
      if (returnedSessionId) {
        this.sessionId = returnedSessionId;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`MCP HTTP transport error ${response.status} ${response.statusText}: ${errText.slice(0, 500)}`);
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      if (contentType.includes('text/event-stream')) {
        const rawSse = await response.text();
        return this.parseSseResponse<T>(rawSse, request.id);
      }

      const json = (await response.json()) as JsonRpcResponse<T>;
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  async sendNotification(notification: JsonRpcNotification): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    try {
      const response = await fetch(this.options.endpointUrl, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(notification),
        signal: controller.signal
      });

      const returnedSessionId = response.headers.get('mcp-session-id');
      if (returnedSessionId) {
        this.sessionId = returnedSessionId;
      }

      if (!response.ok && response.status !== 202 && response.status !== 204) {
        const errText = await response.text().catch(() => '');
        logger.warn(`MCP notification returned status ${response.status}`, { errText: errText.slice(0, 300) });
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    if (this.sessionId) {
      try {
        await fetch(this.options.endpointUrl, {
          method: 'DELETE',
          headers: this.buildHeaders()
        });
      } catch {
        // Ignore cleanup errors on remote MCP server close
      }
      this.sessionId = undefined;
    }
  }

  private parseSseResponse<T>(rawSse: string, expectedId: string | number): JsonRpcResponse<T> {
    const blocks = rawSse.split(/\r?\n\r?\n/);
    let lastJsonRpc: JsonRpcResponse<T> | undefined;

    for (const block of blocks) {
      if (!block.trim()) continue;
      const dataLines: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (dataLines.length === 0) continue;
      const payload = dataLines.join('\n').trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id === expectedId) return item as JsonRpcResponse<T>;
            if (item && 'jsonrpc' in item && ('result' in item || 'error' in item)) lastJsonRpc = item;
          }
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.id === expectedId) {
            return parsed as JsonRpcResponse<T>;
          }
          if ('result' in parsed || 'error' in parsed) {
            lastJsonRpc = parsed as JsonRpcResponse<T>;
          }
        }
      } catch {
        // Ignore non-JSON SSE keepalive/comment frames
      }
    }

    if (lastJsonRpc) {
      return lastJsonRpc;
    }

    throw new Error(`No matching JSON-RPC response for id '${expectedId}' found in SSE stream`);
  }
}

