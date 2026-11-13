import { IInternalDatabasePort } from '../../application/ports/internal-services.port.js';
import { McpCallResult, McpToolSpec } from '../../application/ports/mcp-client.port.js';
import { IMcpProviderAdapter, ProviderExecutionContext } from '../../application/ports/provider-adapter.port.js';
import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { SqlSafetyValidator } from '../../domain/value-objects/sql-safety.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export function getAllowedInternalSchemas(): string[] {
  const raw =
    process.env.MCP_INTERNAL_DB_ALLOWED_SCHEMAS ||
    'iam,orders,inventory,transactions,search,notification,asset,audit,app_config,scheduler,ai';
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export class PostgresInternalDatabaseGateway implements IInternalDatabasePort {
  async listTables(_tenantId: string, schema?: string): Promise<Array<{ schema: string; table: string; type: string }>> {
    const allowed = getAllowedInternalSchemas();
    const targetSchemas = schema ? [schema.toLowerCase()].filter(s => allowed.includes(s)) : allowed;
    if (targetSchemas.length === 0) {
      throw new Error(`Requested schema '${schema}' is not in MCP_INTERNAL_DB_ALLOWED_SCHEMAS`);
    }

    const res = await dbPool.query(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = ANY($1::text[])
       ORDER BY table_schema, table_name`,
      [targetSchemas]
    );
    return res.rows.map(r => ({
      schema: r.table_schema,
      table: r.table_name,
      type: r.table_type
    }));
  }

  async describeTable(
    schema: string,
    table: string
  ): Promise<Array<{ column: string; dataType: string; nullable: boolean }>> {
    const allowed = getAllowedInternalSchemas();
    if (!allowed.includes(schema.toLowerCase())) {
      throw new Error(`Schema '${schema}' is not in MCP_INTERNAL_DB_ALLOWED_SCHEMAS`);
    }

    const res = await dbPool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema.toLowerCase(), table]
    );
    return res.rows.map(r => ({
      column: r.column_name,
      dataType: r.data_type,
      nullable: r.is_nullable === 'YES'
    }));
  }

  async executeReadOnlyQuery(
    tenantId: string,
    sql: string,
    params: any[] = []
  ): Promise<{ rows: Record<string, any>[]; rowCount: number; fields: string[]; executedSql: string }> {
    const allowed = getAllowedInternalSchemas();
    const validation = SqlSafetyValidator.validateReadOnlyQuery(sql, {
      maxLimit: 100,
      allowedSchemas: allowed
    });
    if (!validation.valid || !validation.sanitizedSql) {
      throw new Error(validation.reason || 'Invalid read-only SQL query');
    }

    const executedSql = validation.sanitizedSql;
    return dbPool.withTenantContext(
      tenantId,
      async client => {
        const result = await client.query(executedSql, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount || result.rows.length,
          fields: result.fields.map(f => f.name),
          executedSql
        };
      },
      { readOnly: true, statementTimeoutMs: 5000 }
    );
  }
}

export class InternalDatabaseMcpAdapter implements IMcpProviderAdapter {
  readonly adapterId = 'internal-database-mcp-adapter';

  constructor(private readonly dbGateway: IInternalDatabasePort) {}

  supports(provider: McpProvider): boolean {
    return provider.category === 'DATABASE' && provider.transportType === 'INTERNAL';
  }

  async healthCheck(ctx: ProviderExecutionContext): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    try {
      const tables = await this.dbGateway.listTables(ctx.tenantId);
      return { healthy: true, details: { tableCount: tables.length, allowedSchemas: getAllowedInternalSchemas() } };
    } catch (err: any) {
      return { healthy: false, details: { error: err.message } };
    }
  }

  async listTools(): Promise<McpToolSpec[]> {
    return [
      {
        name: 'list_tables',
        description: 'List internal microservice PostgreSQL tables available for read-only service queries.',
        inputSchema: {
          type: 'object',
          properties: {
            schema: { type: 'string', description: 'Optional schema filter (e.g., orders, inventory, iam)' }
          }
        }
      },
      {
        name: 'describe_table',
        description: 'Inspect columns and data types for a table in an allowed internal schema.',
        inputSchema: {
          type: 'object',
          properties: {
            schema: { type: 'string' },
            table: { type: 'string' }
          },
          required: ['schema', 'table']
        }
      },
      {
        name: 'query_readonly',
        description:
          'Execute a tenant-scoped, read-only SQL SELECT query against internal microservice schemas (capped at 100 rows).',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'Read-only SELECT or WITH query' },
            params: { type: 'array', items: {}, description: 'Optional positional parameters ($1, $2, ...)' }
          },
          required: ['sql']
        }
      }
    ];
  }

  async callTool(ctx: ProviderExecutionContext, toolName: string, args: Record<string, any>): Promise<McpCallResult> {
    if (toolName === 'list_tables') {
      const tables = await this.dbGateway.listTables(ctx.tenantId, args.schema);
      return {
        isError: false,
        content: [{ type: 'json', data: tables }],
        structuredContent: { count: tables.length, tables }
      };
    }

    if (toolName === 'describe_table') {
      const columns = await this.dbGateway.describeTable(args.schema, args.table);
      return {
        isError: false,
        content: [{ type: 'json', data: columns }],
        structuredContent: { schema: args.schema, table: args.table, columns }
      };
    }

    if (toolName === 'query_readonly') {
      const result = await this.dbGateway.executeReadOnlyQuery(ctx.tenantId, args.sql, args.params || []);
      return {
        isError: false,
        content: [{ type: 'json', data: result.rows }],
        structuredContent: result
      };
    }

    throw new Error(`Unknown internal database tool '${toolName}'`);
  }
}

