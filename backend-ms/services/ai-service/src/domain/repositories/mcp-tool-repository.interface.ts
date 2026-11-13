import { McpToolDefinition } from '../entities/mcp-tool.entity.js';

export interface McpToolFilter {
  tenantId: string;
  providerId?: string;
  providerSlug?: string;
  search?: string;
  enabledOnly?: boolean;
}

export interface IMcpToolRepository {
  replaceProviderTools(tenantId: string, providerId: string, tools: McpToolDefinition[]): Promise<void>;
  findByQualifiedName(qualifiedName: string, tenantId: string): Promise<McpToolDefinition | null>;
  findByProviderAndName(providerSlug: string, toolName: string, tenantId: string): Promise<McpToolDefinition | null>;
  list(filter: McpToolFilter): Promise<McpToolDefinition[]>;
  deleteByProviderId(providerId: string, tenantId: string): Promise<void>;
}

