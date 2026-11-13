import { McpProvider } from '../../domain/entities/mcp-provider.entity.js';
import { McpToolDefinition } from '../../domain/entities/mcp-tool.entity.js';
import { ToolInvocationLog } from '../../domain/entities/tool-invocation.entity.js';
import { IMcpProviderRepository, McpProviderFilter } from '../../domain/repositories/mcp-provider-repository.interface.js';
import { IMcpToolRepository, McpToolFilter } from '../../domain/repositories/mcp-tool-repository.interface.js';
import { IToolInvocationRepository, ToolInvocationFilter } from '../../domain/repositories/tool-invocation-repository.interface.js';
import { createBuiltinProviders } from '../providers/builtin-providers.seed.js';

export class InMemoryMcpProviderRepository implements IMcpProviderRepository {
  private readonly providers = new Map<string, McpProvider>();

  private ensureBuiltins(tenantId: string): void {
    for (const b of createBuiltinProviders(tenantId)) {
      const existing = Array.from(this.providers.values()).find(
        p => p.tenantId === tenantId && p.slug === b.slug
      );
      if (!existing) {
        this.providers.set(b.id, b);
      }
    }
  }

  async save(provider: McpProvider): Promise<void> {
    this.providers.set(provider.id, provider);
  }

  async findById(id: string, tenantId: string): Promise<McpProvider | null> {
    this.ensureBuiltins(tenantId);
    const found = this.providers.get(id);
    if (!found || found.tenantId !== tenantId) return null;
    return found;
  }

  async findBySlug(slug: string, tenantId: string): Promise<McpProvider | null> {
    this.ensureBuiltins(tenantId);
    const normalized = slug.trim().toLowerCase();
    for (const p of this.providers.values()) {
      if (p.tenantId === tenantId && p.slug === normalized) return p;
    }
    return null;
  }

  async list(filter: McpProviderFilter): Promise<McpProvider[]> {
    this.ensureBuiltins(filter.tenantId);
    return Array.from(this.providers.values()).filter(p => {
      if (p.tenantId !== filter.tenantId) return false;
      if (filter.category && p.category !== filter.category) return false;
      if (filter.enabledOnly && !p.isEnabled) return false;
      if (filter.includeBuiltin === false && p.isBuiltin) return false;
      return true;
    });
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const found = this.providers.get(id);
    if (!found || found.tenantId !== tenantId || found.isBuiltin) return false;
    return this.providers.delete(id);
  }
}

export class InMemoryMcpToolRepository implements IMcpToolRepository {
  private readonly tools = new Map<string, McpToolDefinition>();

  async replaceProviderTools(tenantId: string, providerId: string, tools: McpToolDefinition[]): Promise<void> {
    for (const [id, t] of this.tools.entries()) {
      if (t.tenantId === tenantId && t.providerId === providerId) {
        this.tools.delete(id);
      }
    }
    for (const tool of tools) {
      this.tools.set(tool.id, tool);
    }
  }

  async findByQualifiedName(qualifiedName: string, tenantId: string): Promise<McpToolDefinition | null> {
    for (const t of this.tools.values()) {
      if (t.tenantId === tenantId && t.qualifiedName === qualifiedName) return t;
    }
    return null;
  }

  async findByProviderAndName(providerSlug: string, toolName: string, tenantId: string): Promise<McpToolDefinition | null> {
    for (const t of this.tools.values()) {
      if (t.tenantId === tenantId && t.providerSlug === providerSlug && t.toolName === toolName) return t;
    }
    return null;
  }

  async list(filter: McpToolFilter): Promise<McpToolDefinition[]> {
    return Array.from(this.tools.values()).filter(t => {
      if (t.tenantId !== filter.tenantId) return false;
      if (filter.providerId && t.providerId !== filter.providerId) return false;
      if (filter.providerSlug && t.providerSlug !== filter.providerSlug) return false;
      if (filter.enabledOnly && !t.isEnabled) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matches =
          t.toolName.toLowerCase().includes(q) ||
          t.qualifiedName.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }

  async deleteByProviderId(providerId: string, tenantId: string): Promise<void> {
    for (const [id, t] of this.tools.entries()) {
      if (t.tenantId === tenantId && t.providerId === providerId) {
        this.tools.delete(id);
      }
    }
  }
}

export class InMemoryToolInvocationRepository implements IToolInvocationRepository {
  private readonly logs: ToolInvocationLog[] = [];

  async save(log: ToolInvocationLog): Promise<void> {
    this.logs.unshift(log);
    if (this.logs.length > 1000) {
      this.logs.length = 1000;
    }
  }

  async list(filter: ToolInvocationFilter): Promise<ToolInvocationLog[]> {
    const limit = Math.min(filter.limit || 50, 200);
    return this.logs
      .filter(l => {
        if (l.tenantId !== filter.tenantId) return false;
        if (filter.providerSlug && l.providerSlug !== filter.providerSlug) return false;
        if (filter.toolName && l.toolName !== filter.toolName) return false;
        if (filter.status && l.status !== filter.status) return false;
        return true;
      })
      .slice(0, limit);
  }
}

