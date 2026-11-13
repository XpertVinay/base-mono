import { IMcpClient, IMcpClientManager, McpConnectionConfig } from '../../application/ports/mcp-client.port.js';
import { McpClient } from './mcp-client.js';
import { StreamableHttpMcpTransport } from './streamable-http-mcp.transport.js';
import { StdioMcpTransport } from './stdio-mcp.transport.js';
import { IMcpTransport } from './mcp-transport.interface.js';

interface CachedClientEntry {
  versionKey: string;
  client: IMcpClient;
}

export class McpClientManager implements IMcpClientManager {
  private readonly clients = new Map<string, CachedClientEntry>();

  private buildMapKey(tenantId: string, providerId: string): string {
    return `${tenantId}:${providerId}`;
  }

  private createTransport(config: McpConnectionConfig): IMcpTransport {
    if (config.transportType === 'STREAMABLE_HTTP' || config.transportType === 'SSE') {
      if (!config.endpointUrl) {
        throw new Error(`Provider '${config.providerSlug}' requires endpointUrl for ${config.transportType}`);
      }
      return new StreamableHttpMcpTransport({
        endpointUrl: config.endpointUrl,
        authType: config.authType,
        credentials: config.credentials,
        defaultHeaders: config.config?.defaultHeaders,
        timeoutMs: config.timeoutMs || config.config?.timeoutMs
      });
    }

    if (config.transportType === 'STDIO') {
      if (!config.command) {
        throw new Error(`Provider '${config.providerSlug}' requires command for STDIO transport`);
      }
      return new StdioMcpTransport({
        command: config.command,
        args: config.args,
        env: config.credentials?.env,
        cwd: config.config?.cwd,
        timeoutMs: config.timeoutMs || config.config?.timeoutMs
      });
    }

    throw new Error(`Unsupported MCP transport type '${config.transportType}' for McpClientManager`);
  }

  async getClient(config: McpConnectionConfig): Promise<IMcpClient> {
    const key = this.buildMapKey(config.tenantId, config.providerId);
    const versionKey = `${config.updatedAt || ''}:${config.endpointUrl || ''}:${config.command || ''}`;
    const existing = this.clients.get(key);

    if (existing && existing.versionKey === versionKey) {
      return existing.client;
    }

    if (existing) {
      await existing.client.close().catch(() => {});
      this.clients.delete(key);
    }

    const transport = this.createTransport(config);
    const client = new McpClient(transport);
    await client.connect();

    this.clients.set(key, { versionKey, client });
    return client;
  }

  async evictClient(tenantId: string, providerId: string): Promise<void> {
    const key = this.buildMapKey(tenantId, providerId);
    const existing = this.clients.get(key);
    if (existing) {
      await existing.client.close().catch(() => {});
      this.clients.delete(key);
    }
  }

  async closeAll(): Promise<void> {
    const closures = Array.from(this.clients.values()).map(entry => entry.client.close().catch(() => {}));
    await Promise.all(closures);
    this.clients.clear();
  }
}

