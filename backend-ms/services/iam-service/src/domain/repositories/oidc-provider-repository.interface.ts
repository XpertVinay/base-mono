import { OidcProvider } from '../entities/oidc-provider.entity.js';

export interface IOidcProviderRepository {
  findById(id: string): Promise<OidcProvider | null>;
  findBySlug(tenantId: string, slug: string): Promise<OidcProvider | null>;
  findByIdOrSlug(tenantId: string, idOrSlug: string): Promise<OidcProvider | null>;
  listByTenant(tenantId: string, onlyEnabled?: boolean): Promise<OidcProvider[]>;
  save(provider: OidcProvider): Promise<void>;
  update(provider: OidcProvider): Promise<void>;
  delete(id: string, tenantId: string): Promise<boolean>;
  listSystemDefaults?(onlyEnabled?: boolean): Promise<OidcProvider[]>;
  findSystemDefaultBySlug?(slug: string): Promise<OidcProvider | null>;
  listPendingApprovals?(): Promise<OidcProvider[]>;
}
