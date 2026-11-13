import {
  IMcpClient,
  McpCallResult,
  McpInitializeResult,
  McpPromptResult,
  McpPromptSpec,
  McpResourceContent,
  McpResourceSpec,
  McpServerCapabilities,
  McpToolSpec
} from '../../application/ports/mcp-client.port.js';
import { IMcpTransport } from './mcp-transport.interface.js';
import { MCP_PROTOCOL_VERSION } from './mcp-jsonrpc.types.js';

export class McpClient implements IMcpClient {
  private nextId = 1;
  private initialized = false;
  private initPromise: Promise<McpInitializeResult> | null = null;
  public serverInfo?: { name: string; version: string };
  public capabilities?: McpServerCapabilities;

  constructor(
    private readonly transport: IMcpTransport,
    private readonly clientInfo = { name: 'ai-service-mcp-client', version: '1.0.0' }
  ) {}

  private allocateId(): number {
    return this.nextId++;
  }

  async connect(): Promise<McpInitializeResult> {
    if (this.initialized && this.transport.isConnected()) {
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: this.capabilities || {},
        serverInfo: this.serverInfo || { name: 'mcp-server', version: 'unknown' }
      };
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.transport.connect();

      const resp = await this.transport.sendRequest<McpInitializeResult>({
        jsonrpc: '2.0',
        id: this.allocateId(),
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            roots: { listChanged: false },
            sampling: {}
          },
          clientInfo: this.clientInfo
        }
      });

      if (resp.error) {
        throw new Error(`MCP initialize failed (${resp.error.code}): ${resp.error.message}`);
      }

      const result = resp.result!;
      this.serverInfo = result.serverInfo;
      this.capabilities = result.capabilities || {};
      this.initialized = true;

      await this.transport.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });

      return result;
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.transport.isConnected()) {
      await this.connect();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const resp = await this.transport.sendRequest({
        jsonrpc: '2.0',
        id: this.allocateId(),
        method: 'ping'
      });
      return !resp.error;
    } catch {
      return false;
    }
  }

  async listTools(): Promise<McpToolSpec[]> {
    await this.ensureInitialized();
    const tools: McpToolSpec[] = [];
    let cursor: string | undefined;

    do {
      const resp = await this.transport.sendRequest<{ tools: McpToolSpec[]; nextCursor?: string }>({
        jsonrpc: '2.0',
        id: this.allocateId(),
        method: 'tools/list',
        params: cursor ? { cursor } : {}
      });

      if (resp.error) {
        throw new Error(`MCP tools/list failed (${resp.error.code}): ${resp.error.message}`);
      }

      if (Array.isArray(resp.result?.tools)) {
        tools.push(...resp.result.tools);
      }
      cursor = resp.result?.nextCursor;
    } while (cursor);

    return tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<McpCallResult> {
    await this.ensureInitialized();
    const resp = await this.transport.sendRequest<McpCallResult>({
      jsonrpc: '2.0',
      id: this.allocateId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args || {}
      }
    });

    if (resp.error) {
      throw new Error(`MCP tools/call '${name}' failed (${resp.error.code}): ${resp.error.message}`);
    }

    const result = resp.result || { content: [], isError: false };
    return {
      isError: Boolean(result.isError),
      content: Array.isArray(result.content) ? result.content : [{ type: 'json', data: result }],
      structuredContent: result.structuredContent,
      meta: result.meta
    };
  }

  async listResources(): Promise<McpResourceSpec[]> {
    await this.ensureInitialized();
    const resources: McpResourceSpec[] = [];
    let cursor: string | undefined;

    do {
      const resp = await this.transport.sendRequest<{ resources: McpResourceSpec[]; nextCursor?: string }>({
        jsonrpc: '2.0',
        id: this.allocateId(),
        method: 'resources/list',
        params: cursor ? { cursor } : {}
      });

      if (resp.error) {
        throw new Error(`MCP resources/list failed (${resp.error.code}): ${resp.error.message}`);
      }

      if (Array.isArray(resp.result?.resources)) {
        resources.push(...resp.result.resources);
      }
      cursor = resp.result?.nextCursor;
    } while (cursor);

    return resources;
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    await this.ensureInitialized();
    const resp = await this.transport.sendRequest<{ contents: McpResourceContent[] }>({
      jsonrpc: '2.0',
      id: this.allocateId(),
      method: 'resources/read',
      params: { uri }
    });

    if (resp.error) {
      throw new Error(`MCP resources/read '${uri}' failed (${resp.error.code}): ${resp.error.message}`);
    }

    return resp.result?.contents || [];
  }

  async listPrompts(): Promise<McpPromptSpec[]> {
    await this.ensureInitialized();
    const prompts: McpPromptSpec[] = [];
    let cursor: string | undefined;

    do {
      const resp = await this.transport.sendRequest<{ prompts: McpPromptSpec[]; nextCursor?: string }>({
        jsonrpc: '2.0',
        id: this.allocateId(),
        method: 'prompts/list',
        params: cursor ? { cursor } : {}
      });

      if (resp.error) {
        throw new Error(`MCP prompts/list failed (${resp.error.code}): ${resp.error.message}`);
      }

      if (Array.isArray(resp.result?.prompts)) {
        prompts.push(...resp.result.prompts);
      }
      cursor = resp.result?.nextCursor;
    } while (cursor);

    return prompts;
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<McpPromptResult> {
    await this.ensureInitialized();
    const resp = await this.transport.sendRequest<McpPromptResult>({
      jsonrpc: '2.0',
      id: this.allocateId(),
      method: 'prompts/get',
      params: {
        name,
        ...(args ? { arguments: args } : {})
      }
    });

    if (resp.error) {
      throw new Error(`MCP prompts/get '${name}' failed (${resp.error.code}): ${resp.error.message}`);
    }

    return resp.result!;
  }

  async close(): Promise<void> {
    this.initialized = false;
    await this.transport.close();
  }
}

