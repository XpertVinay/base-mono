import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';

export class ProviderAdapterRegistry {
  private readonly adapters: IMcpProviderAdapter[] = [];

  register(adapter: IMcpProviderAdapter): this {
    const idx = this.adapters.findIndex(a => a.adapterId === adapter.adapterId);
    if (idx >= 0) {
      this.adapters[idx] = adapter;
    } else {
      this.adapters.push(adapter);
    }
    return this;
  }

  resolve(provider: McpProvider): IMcpProviderAdapter {
    // Prefer specific non-generic adapters first (reverse registration or explicit priority)
    for (const adapter of this.adapters) {
      if (adapter.supports(provider)) {
        return adapter;
      }
    }
    throw new Error(
      `No MCP provider adapter registered for provider '${provider.slug}' (category=${provider.category}, transport=${provider.transportType})`
    );
  }

  listAdapterIds(): string[] {
    return this.adapters.map(a => a.adapterId);
  }

  async checkHealth(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    const adapter = this.resolve(ctx.provider);
    return adapter.healthCheck(ctx);
  }
}

