import {
  IMcpClientManager,
  McpCallResult,
  McpConnectionConfig,
  McpPromptResult,
  McpPromptSpec,
  McpResourceContent,
  McpResourceSpec,
  McpToolSpec
} from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';

export class ExternalMcpServerAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'external-mcp-server-adapter';

  constructor(private readonly clientManager: IMcpClientManager) {}

  supports(provider: McpProvider): boolean {
    return (
      provider.transportType === 'STREAMABLE_HTTP' ||
      provider.transportType === 'SSE' ||
      provider.transportType === 'STDIO'
    );
  }

  private toConnectionConfig(ctx: ProviderExecutionContext): McpConnectionConfig {
    return {
      providerId: ctx.provider.id,
      providerSlug: ctx.provider.slug,
      tenantId: ctx.tenantId,
      transportType: ctx.provider.transportType,
      endpointUrl: ctx.provider.endpointUrl,
      command: ctx.provider.command,
      args: ctx.provider.args,
      authType: ctx.provider.authType,
      credentials: ctx.credentials,
      config: ctx.provider.config,
      timeoutMs: ctx.provider.config?.timeoutMs,
      updatedAt: ctx.provider.updatedAt.toISOString()
    };
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    try {
      const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
      const ok = await client.ping();
      return {
        healthy: ok,
        details: {
          serverInfo: client.serverInfo,
          capabilities: client.capabilities
        }
      };
    } catch (err: any) {
      return {
        healthy: false,
        details: { error: err?.message || 'Failed to connect to external MCP server' }
      };
    }
  }

  async listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.listTools();
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.callTool(toolName, args);
  }

  async listResources(ctx: ProviderExecutionContext): Promise<McpResourceSpec[]> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.listResources();
  }

  async readResource(ctx: ProviderExecutionContext, uri: string): Promise<McpResourceContent[]> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.readResource(uri);
  }

  async listPrompts(ctx: ProviderExecutionContext): Promise<McpPromptSpec[]> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.listPrompts();
  }

  async getPrompt(ctx: ProviderExecutionContext, name: string, args?: Record<string, string>): Promise<McpPromptResult> {
    const client = await this.clientManager.getClient(this.toConnectionConfig(ctx));
    return client.getPrompt(name, args);
  }
}

