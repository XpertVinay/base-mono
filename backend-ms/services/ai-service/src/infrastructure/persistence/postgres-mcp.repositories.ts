import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { McpToolDefinition } from '../../domain/entities/mcp-tool.entity.js';
import { ToolInvocationLog } from '../../domain/entities/tool-invocation.entity.js';
import { IMcpProviderRepository, McpProviderFilter } from '../../domain/repositories/mcp-provider-repository.interface.js';
import { IMcpToolRepository, McpToolFilter } from '../../domain/repositories/mcp-tool-repository.interface.js';
import { IToolInvocationRepository, ToolInvocationFilter } from '../../domain/repositories/tool-invocation-repository.interface.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';
import { createBuiltinProviders } from '../providers/builtin-providers.seed.js';

export class PostgresMcpProviderRepository implements IMcpProviderRepository {
  async save(provider: McpProvider): Promise<void> {
    await dbPool.query(
      `INSERT INTO ai.mcp_providers (
        id, tenant_id, slug, name, category, transport_type, endpoint_url, command, args,
        auth_type, credentials_encrypted, config, capabilities, is_builtin, is_enabled,
        health_status, last_synced_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        transport_type = EXCLUDED.transport_type,
        endpoint_url = EXCLUDED.endpoint_url,
        command = EXCLUDED.command,
        args = EXCLUDED.args,
        auth_type = EXCLUDED.auth_type,
        credentials_encrypted = COALESCE(EXCLUDED.credentials_encrypted, ai.mcp_providers.credentials_encrypted),
        config = EXCLUDED.config,
        capabilities = EXCLUDED.capabilities,
        is_enabled = EXCLUDED.is_enabled,
        health_status = EXCLUDED.health_status,
        last_synced_at = EXCLUDED.last_synced_at,
        updated_at = EXCLUDED.updated_at`,
      [
        provider.id,
        provider.tenantId,
        provider.slug,
        provider.name,
        provider.category,
        provider.transportType,
        provider.endpointUrl || null,
        provider.command || null,
        JSON.stringify(provider.args || []),
        provider.authType,
        provider.credentialsEncrypted || null,
        JSON.stringify(provider.config || {}),
        JSON.stringify(provider.capabilities || {}),
        provider.isBuiltin,
        provider.isEnabled,
        provider.healthStatus,
        provider.lastSyncedAt || null,
        provider.createdAt,
        provider.updatedAt
      ]
    );
  }

  async findById(id: string, tenantId: string): Promise<McpProvider | null> {
    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_providers WHERE id = $1 AND (tenant_id = $2 OR (is_builtin = TRUE AND tenant_id = 'default'))`,
      [id, tenantId]
    );
    if (res.rows.length > 0) {
      return this.mapToDomain(res.rows[0]);
    }
    const builtin = createBuiltinProviders(tenantId).find(b => b.id === id || b.id === `builtin-${id.split('-')[1]}-${tenantId}`);
    return builtin || null;
  }

  async findBySlug(slug: string, tenantId: string): Promise<McpProvider | null> {
    const normalized = slug.trim().toLowerCase();
    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_providers
       WHERE slug = $1 AND (tenant_id = $2 OR (is_builtin = TRUE AND tenant_id = 'default'))
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [normalized, tenantId]
    );
    if (res.rows.length > 0) {
      return this.mapToDomain(res.rows[0]);
    }
    const builtin = createBuiltinProviders(tenantId).find(b => b.slug === normalized);
    return builtin || null;
  }

  async list(filter: McpProviderFilter): Promise<McpProvider[]> {
    const conditions: string[] = [`(tenant_id = $1 OR (is_builtin = TRUE AND tenant_id = 'default'))`];
    const params: any[] = [filter.tenantId];

    if (filter.category) {
      params.push(filter.category);
      conditions.push(`category = $${params.length}`);
    }
    if (filter.enabledOnly) {
      conditions.push(`is_enabled = TRUE`);
    }
    if (filter.includeBuiltin === false) {
      conditions.push(`is_builtin = FALSE`);
    }

    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_providers WHERE ${conditions.join(' AND ')} ORDER BY is_builtin DESC, created_at ASC`,
      params
    );

    const rows = res.rows.map(r => this.mapToDomain(r));
    if (filter.includeBuiltin !== false) {
      const existingSlugs = new Set(rows.map(r => r.slug));
      for (const b of createBuiltinProviders(filter.tenantId)) {
        if (existingSlugs.has(b.slug)) continue;
        if (filter.category && b.category !== filter.category) continue;
        if (filter.enabledOnly && !b.isEnabled) continue;
        rows.unshift(b);
      }
    }
    return rows;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM ai.mcp_providers WHERE id = $1 AND tenant_id = $2 AND is_builtin = FALSE`,
      [id, tenantId]
    );
    return (res.rowCount || 0) > 0;
  }

  private mapToDomain(row: any): McpProvider {
    return McpProvider.reconstitute(
      {
        tenantId: row.tenant_id,
        slug: row.slug,
        name: row.name,
        category: row.category,
        transportType: row.transport_type,
        endpointUrl: row.endpoint_url || undefined,
        command: row.command || undefined,
        args: Array.isArray(row.args) ? row.args : [],
        authType: row.auth_type || 'NONE',
        credentialsEncrypted: row.credentials_encrypted || undefined,
        config: row.config || {},
        capabilities: row.capabilities || {},
        isBuiltin: Boolean(row.is_builtin),
        isEnabled: Boolean(row.is_enabled),
        healthStatus: row.health_status || 'UNKNOWN',
        lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}

export class PostgresMcpToolRepository implements IMcpToolRepository {
  async replaceProviderTools(tenantId: string, providerId: string, tools: McpToolDefinition[]): Promise<void> {
    await dbPool.withTenantContext(tenantId, async client => {
      await client.query(`DELETE FROM ai.mcp_tools WHERE tenant_id = $1 AND provider_id = $2`, [tenantId, providerId]);
      for (const tool of tools) {
        await client.query(
          `INSERT INTO ai.mcp_tools (
            id, tenant_id, provider_id, provider_slug, tool_name, qualified_name,
            description, input_schema, annotations, is_enabled, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            tool.id,
            tool.tenantId,
            tool.providerId,
            tool.providerSlug,
            tool.toolName,
            tool.qualifiedName,
            tool.description || null,
            JSON.stringify(tool.inputSchema || { type: 'object', properties: {} }),
            JSON.stringify(tool.annotations || {}),
            tool.isEnabled,
            tool.createdAt,
            tool.updatedAt
          ]
        );
      }
    });
  }

  async findByQualifiedName(qualifiedName: string, tenantId: string): Promise<McpToolDefinition | null> {
    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_tools WHERE qualified_name = $1 AND tenant_id = $2 LIMIT 1`,
      [qualifiedName, tenantId]
    );
    return res.rows.length > 0 ? this.mapToDomain(res.rows[0]) : null;
  }

  async findByProviderAndName(providerSlug: string, toolName: string, tenantId: string): Promise<McpToolDefinition | null> {
    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_tools WHERE provider_slug = $1 AND tool_name = $2 AND tenant_id = $3 LIMIT 1`,
      [providerSlug, toolName, tenantId]
    );
    return res.rows.length > 0 ? this.mapToDomain(res.rows[0]) : null;
  }

  async list(filter: McpToolFilter): Promise<McpToolDefinition[]> {
    const conditions: string[] = [`tenant_id = $1`];
    const params: any[] = [filter.tenantId];

    if (filter.providerId) {
      params.push(filter.providerId);
      conditions.push(`provider_id = $${params.length}`);
    }
    if (filter.providerSlug) {
      params.push(filter.providerSlug);
      conditions.push(`provider_slug = $${params.length}`);
    }
    if (filter.enabledOnly) {
      conditions.push(`is_enabled = TRUE`);
    }
    if (filter.search) {
      params.push(`%${filter.search}%`);
      conditions.push(`(tool_name ILIKE $${params.length} OR qualified_name ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    const res = await dbPool.query(
      `SELECT * FROM ai.mcp_tools WHERE ${conditions.join(' AND ')} ORDER BY provider_slug, tool_name`,
      params
    );
    return res.rows.map(r => this.mapToDomain(r));
  }

  async deleteByProviderId(providerId: string, tenantId: string): Promise<void> {
    await dbPool.query(`DELETE FROM ai.mcp_tools WHERE provider_id = $1 AND tenant_id = $2`, [providerId, tenantId]);
  }

  private mapToDomain(row: any): McpToolDefinition {
    return McpToolDefinition.reconstitute(
      {
        tenantId: row.tenant_id,
        providerId: row.provider_id,
        providerSlug: row.provider_slug,
        toolName: row.tool_name,
        qualifiedName: row.qualified_name,
        description: row.description || undefined,
        inputSchema: row.input_schema || { type: 'object', properties: {} },
        annotations: row.annotations || {},
        isEnabled: Boolean(row.is_enabled),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}

export class PostgresToolInvocationRepository implements IToolInvocationRepository {
  async save(log: ToolInvocationLog): Promise<void> {
    await dbPool.query(
      `INSERT INTO ai.tool_invocations (
        id, tenant_id, actor_id, provider_id, provider_slug, tool_name, category,
        status, arguments_redacted, result_summary, error_message, duration_ms, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        log.id,
        log.tenantId,
        log.actorId || null,
        log.providerId || null,
        log.providerSlug,
        log.toolName,
        log.category,
        log.status,
        JSON.stringify(log.argumentsRedacted || {}),
        log.resultSummary ? JSON.stringify(log.resultSummary) : null,
        log.errorMessage || null,
        log.durationMs,
        log.correlationId || null,
        log.createdAt
      ]
    );
  }

  async list(filter: ToolInvocationFilter): Promise<ToolInvocationLog[]> {
    const conditions: string[] = [`tenant_id = $1`];
    const params: any[] = [filter.tenantId];

    if (filter.providerSlug) {
      params.push(filter.providerSlug);
      conditions.push(`provider_slug = $${params.length}`);
    }
    if (filter.toolName) {
      params.push(filter.toolName);
      conditions.push(`tool_name = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    const limit = Math.min(filter.limit || 50, 200);
    params.push(limit);

    const res = await dbPool.query(
      `SELECT * FROM ai.tool_invocations WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );

    return res.rows.map(row =>
      ToolInvocationLog.reconstitute(
        {
          tenantId: row.tenant_id,
          actorId: row.actor_id || undefined,
          providerId: row.provider_id || undefined,
          providerSlug: row.provider_slug,
          toolName: row.tool_name,
          category: row.category,
          status: row.status,
          argumentsRedacted: row.arguments_redacted || {},
          resultSummary: row.result_summary || undefined,
          errorMessage: row.error_message || undefined,
          durationMs: Number(row.duration_ms || 0),
          correlationId: row.correlation_id || undefined,
          createdAt: new Date(row.created_at)
        },
        row.id
      )
    );
  }
}

