import { McpProvider } from '../entities/mcp-provider.entity.js';
import { McpProviderCategory } from '../../shared/contracts/index.js';

export interface McpProviderFilter {
  tenantId: string;
  category?: McpProviderCategory;
  enabledOnly?: boolean;
  includeBuiltin?: boolean;
}

export interface IMcpProviderRepository {
  save(provider: McpProvider): Promise<void>;
  findById(id: string, tenantId: string): Promise<McpProvider | null>;
  findBySlug(slug: string, tenantId: string): Promise<McpProvider | null>;
  list(filter: McpProviderFilter): Promise<McpProvider[]>;
  delete(id: string, tenantId: string): Promise<boolean>;
}

