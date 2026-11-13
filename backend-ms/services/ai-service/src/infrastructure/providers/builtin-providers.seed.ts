import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';

export function createBuiltinProviders(tenantId: string = 'default'): McpProvider[] {
  return [
    McpProvider.create(
      {
        tenantId,
        slug: 'builtin-communication',
        name: 'Platform Multi-Channel Communication MCP',
        category: 'COMMUNICATION',
        transportType: 'INTERNAL',
        authType: 'NONE',
        config: {
          channels: ['EMAIL', 'SMS', 'PUSH', 'WEBHOOK'],
          supportsExternalWebhooks: true
        },
        capabilities: { tools: { listChanged: false } },
        isBuiltin: true,
        isEnabled: true,
        healthStatus: 'HEALTHY'
      },
      `builtin-comm-${tenantId}`
    ),
    McpProvider.create(
      {
        tenantId,
        slug: 'builtin-search',
        name: 'Platform Federated Search MCP',
        category: 'SEARCH',
        transportType: 'INTERNAL',
        authType: 'NONE',
        config: {
          supportsFederatedSearch: true
        },
        capabilities: { tools: { listChanged: false } },
        isBuiltin: true,
        isEnabled: true,
        healthStatus: 'HEALTHY'
      },
      `builtin-search-${tenantId}`
    ),
    McpProvider.create(
      {
        tenantId,
        slug: 'builtin-internal-db',
        name: 'Platform Internal Read-Only Database MCP',
        category: 'DATABASE',
        transportType: 'INTERNAL',
        authType: 'NONE',
        config: {
          readOnly: true,
          maxRows: 100
        },
        capabilities: { tools: { listChanged: false } },
        isBuiltin: true,
        isEnabled: true,
        healthStatus: 'HEALTHY'
      },
      `builtin-intdb-${tenantId}`
    ),
    McpProvider.create(
      {
        tenantId,
        slug: 'builtin-external-api',
        name: 'Platform External REST & GraphQL API MCP',
        category: 'EXTERNAL_API',
        transportType: 'REST_API',
        authType: 'NONE',
        config: {
          supportsRest: true,
          supportsGraphql: true
        },
        capabilities: { tools: { listChanged: false } },
        isBuiltin: true,
        isEnabled: true,
        healthStatus: 'HEALTHY'
      },
      `builtin-extapi-${tenantId}`
    )
  ];
}

