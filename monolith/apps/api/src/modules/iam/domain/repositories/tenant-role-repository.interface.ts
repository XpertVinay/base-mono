import { TenantRole } from '../entities/tenant-role.entity.js';

export interface ITenantRoleRepository {
  findById(id: string): Promise<TenantRole | null>;
  findByTenantAndName(tenantId: string, name: string): Promise<TenantRole | null>;
  findByTenantId(tenantId: string): Promise<TenantRole[]>;
  save(role: TenantRole): Promise<void>;
  delete(id: string): Promise<void>;
}
