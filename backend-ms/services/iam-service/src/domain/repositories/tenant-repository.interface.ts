import { Tenant } from '../entities/tenant.entity.js';

export interface ITenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findByIdOrSlug(idOrSlug: string): Promise<Tenant | null>;
  listAll(): Promise<Tenant[]>;
  save(tenant: Tenant): Promise<void>;
  update(tenant: Tenant): Promise<void>;
  delete(id: string): Promise<boolean>;
}
