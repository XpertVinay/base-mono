import { IExternalApiPort, ISearchGatewayPort } from '../../application/ports/internal-services.port.js';
import { McpCallResult, McpToolSpec } from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { applyAuthHeaders } from './external-api-mcp.adapter.js';

export class SearchMcpAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'search-mcp-adapter';

  constructor(
    private readonly searchGateway: ISearchGatewayPort,
    private readonly apiClient: IExternalApiPort
  ) {}

  supports(provider: McpProvider): boolean {
    return (
      provider.category === 'SEARCH' &&
      (provider.transportType === 'INTERNAL' || provider.transportType === 'REST_API')
    );
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    if (ctx.provider.transportType === 'REST_API') {
      return { healthy: Boolean(ctx.provider.endpointUrl), details: { mode: 'external-search-api' } };
    }
    try {
      await this.searchGateway.search('healthcheck');
      return { healthy: true, details: { backend: 'search-service:grpc' } };
    } catch (err: any) {
      return { healthy: false, details: { backend: 'search-service:grpc', error: err.message } };
    }
  }

  async listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]> {
    if (ctx.provider.transportType === 'REST_API') {
      return [
        {
          name: 'search',
          description: `Execute a search query against external search provider '${ctx.provider.name}'.`,
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number', default: 10 },
              filters: { type: 'object', additionalProperties: true }
            },
            required: ['query']
          }
        }
      ];
    }

    return [
      {
        name: 'query_internal',
        description: 'Search indexed platform documents via internal search-service.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            type: { type: 'string', description: 'Optional document type filter (e.g., USER, ORDER)' }
          },
          required: ['query']
        }
      },
      {
        name: 'federated_search',
        description: 'Run search against internal search-service and optional external HTTP search endpoints, returning unified results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            type: { type: 'string' },
            externalSearchUrl: { type: 'string', description: 'Optional external search API URL' }
          },
          required: ['query']
        }
      }
    ];
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (ctx.provider.transportType === 'REST_API' && toolName === 'search') {
      if (!ctx.provider.endpointUrl) {
        throw new Error(`External search provider '${ctx.provider.slug}' requires endpointUrl`);
      }
      const headers = applyAuthHeaders(
        ctx.provider.config?.defaultHeaders || {},
        ctx.provider.authType,
        ctx.credentials
      );
      const method = (ctx.provider.config?.method || 'POST').toUpperCase();
      const queryParam = ctx.provider.config?.queryParam || 'q';
      const res = await this.apiClient.request({
        url: ctx.provider.endpointUrl,
        method: method as any,
        headers,
        query: method === 'GET' ? { [queryParam]: args.query, limit: args.limit || 10 } : undefined,
        body: method !== 'GET' ? { query: args.query, limit: args.limit || 10, filters: args.filters } : undefined
      });
      return {
        isError: !res.ok,
        content: [{ type: 'json', data: res.data }],
        structuredContent: { provider: ctx.provider.slug, status: res.status, results: res.data }
      };
    }

    if (toolName === 'query_internal') {
      const items = await this.searchGateway.search(args.query, args.type);
      return {
        isError: false,
        content: [{ type: 'json', data: items }],
        structuredContent: { source: 'search-service', count: items.length, items }
      };
    }

    if (toolName === 'federated_search') {
      const internalPromise = this.searchGateway
        .search(args.query, args.type)
        .then(items => ({ ok: true as const, items }))
        .catch(err => ({ ok: false as const, error: err.message, items: [] as any[] }));

      const externalPromise = args.externalSearchUrl
        ? this.apiClient
            .request({
              url: args.externalSearchUrl,
              method: 'GET',
              query: { q: args.query }
            })
            .then(r => ({ ok: r.ok, data: r.data }))
            .catch(err => ({ ok: false, error: err.message }))
        : Promise.resolve(null);

      const [internal, external] = await Promise.all([internalPromise, externalPromise]);
      const merged = {
        query: args.query,
        internal,
        ...(external ? { external } : {})
      };

      return {
        isError: !internal.ok && (!external || !external.ok),
        content: [{ type: 'json', data: merged }],
        structuredContent: merged
      };
    }

    throw new Error(`Unknown search tool '${toolName}'`);
  }
}

