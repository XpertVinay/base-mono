import pg from 'pg';
import { IExternalApiPort } from '../../application/ports/internal-services.port.js';
import { McpCallResult, McpToolSpec } from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { SqlSafetyValidator } from '../../domain/value-objects/sql-safety.js';
import { applyAuthHeaders } from './external-api-mcp.adapter.js';

const { Pool } = pg;

export class ExternalDatabaseMcpAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'external-database-mcp-adapter';
  private readonly externalPools = new Map<string, { versionKey: string; pool: pg.Pool }>();

  constructor(private readonly apiClient: IExternalApiPort) {}

  supports(provider: McpProvider): boolean {
    return (
      provider.transportType === 'POSTGRES_EXTERNAL' ||
      (provider.category === 'DATABASE' && provider.transportType === 'REST_API')
    );
  }

  private getOrCreatePool(ctx: ProviderExecutionContext): pg.Pool {
    const cacheKey = `${ctx.tenantId}:${ctx.provider.id}`;
    const versionKey = ctx.provider.updatedAt.toISOString();
    const existing = this.externalPools.get(cacheKey);
    if (existing && existing.versionKey === versionKey) {
      return existing.pool;
    }

    if (existing) {
      existing.pool.end().catch(() => {});
      this.externalPools.delete(cacheKey);
    }

    const cfg = ctx.provider.config || {};
    const creds = ctx.credentials || {};
    const connectionString = creds.connectionString || ctx.provider.endpointUrl;

    const pool = connectionString
      ? new Pool({
          connectionString,
          max: cfg.maxPoolSize || 5,
          connectionTimeoutMillis: cfg.timeoutMs || 5000,
          idleTimeoutMillis: 30000,
          ssl: cfg.ssl ? { rejectUnauthorized: false } : false
        })
      : new Pool({
          host: cfg.host,
          port: cfg.port || 5432,
          database: cfg.database,
          user: creds.username || cfg.user,
          password: creds.password,
          max: cfg.maxPoolSize || 5,
          connectionTimeoutMillis: cfg.timeoutMs || 5000,
          idleTimeoutMillis: 30000,
          ssl: cfg.ssl ? { rejectUnauthorized: false } : false
        });

    this.externalPools.set(cacheKey, { versionKey, pool });
    return pool;
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    if (ctx.provider.transportType === 'REST_API') {
      return { healthy: Boolean(ctx.provider.endpointUrl), details: { mode: 'http-data-api' } };
    }
    try {
      const pool = this.getOrCreatePool(ctx);
      await pool.query('SELECT 1 AS ok');
      return { healthy: true, details: { engine: 'postgres-external' } };
    } catch (err: any) {
      return { healthy: false, details: { engine: 'postgres-external', error: err.message } };
    }
  }

  async listTools(ctx: ProviderExecutionContext): Promise<McpToolSpec[]> {
    if (ctx.provider.transportType === 'REST_API') {
      return [
        {
          name: 'query_data_api',
          description: `Execute a query against external Database HTTP Data API '${ctx.provider.name}'.`,
          inputSchema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Optional relative path on Data API endpoint' },
              method: { type: 'string', enum: ['GET', 'POST'], default: 'POST' },
              query: { type: 'object', additionalProperties: true },
              body: {}
            }
          }
        }
      ];
    }

    return [
      {
        name: 'list_tables',
        description: `List tables in external database provider '${ctx.provider.name}'.`,
        inputSchema: {
          type: 'object',
          properties: {
            schema: { type: 'string', default: 'public' }
          }
        }
      },
      {
        name: 'query_readonly',
        description: `Execute a read-only SELECT query against external PostgreSQL provider '${ctx.provider.name}'.`,
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            params: { type: 'array', items: {} }
          },
          required: ['sql']
        }
      }
    ];
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (ctx.provider.transportType === 'REST_API' && toolName === 'query_data_api') {
      if (!ctx.provider.endpointUrl) {
        throw new Error(`External DB Data API '${ctx.provider.slug}' requires endpointUrl`);
      }
      const targetUrl = args.path
        ? new URL(args.path, ctx.provider.endpointUrl.endsWith('/') ? ctx.provider.endpointUrl : `${ctx.provider.endpointUrl}/`).toString()
        : ctx.provider.endpointUrl;
      const headers = applyAuthHeaders(ctx.provider.config?.defaultHeaders || {}, ctx.provider.authType, ctx.credentials);
      const res = await this.apiClient.request({
        url: targetUrl,
        method: args.method || 'POST',
        headers,
        query: args.query,
        body: args.body
      });
      return {
        isError: !res.ok,
        content: [{ type: 'json', data: res.data }],
        structuredContent: { status: res.status, data: res.data }
      };
    }

    const pool = this.getOrCreatePool(ctx);

    if (toolName === 'list_tables') {
      const targetSchema = args.schema || ctx.provider.config?.defaultSchema || 'public';
      const res = await pool.query(
        `SELECT table_schema, table_name, table_type
         FROM information_schema.tables
         WHERE table_schema = $1
         ORDER BY table_name`,
        [targetSchema]
      );
      return {
        isError: false,
        content: [{ type: 'json', data: res.rows }],
        structuredContent: { schema: targetSchema, count: res.rows.length, tables: res.rows }
      };
    }

    if (toolName === 'query_readonly') {
      const allowedSchemas = Array.isArray(ctx.provider.config?.allowedSchemas)
        ? ctx.provider.config.allowedSchemas
        : undefined;
      const validation = SqlSafetyValidator.validateReadOnlyQuery(args.sql, {
        maxLimit: ctx.provider.config?.maxRows || 100,
        allowedSchemas
      });
      if (!validation.valid || !validation.sanitizedSql) {
        throw new Error(validation.reason || 'Invalid read-only SQL query');
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query(`SELECT set_config('statement_timeout', '5000', true)`);
        const result = await client.query(validation.sanitizedSql, args.params || []);
        await client.query('COMMIT');
        return {
          isError: false,
          content: [{ type: 'json', data: result.rows }],
          structuredContent: {
            rows: result.rows,
            rowCount: result.rowCount || result.rows.length,
            fields: result.fields.map(f => f.name),
            executedSql: validation.sanitizedSql
          }
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    throw new Error(`Unknown external database tool '${toolName}'`);
  }

  async closeAll(): Promise<void> {
    const pools = Array.from(this.externalPools.values()).map(p => p.pool.end().catch(() => {}));
    await Promise.all(pools);
    this.externalPools.clear();
  }
}

