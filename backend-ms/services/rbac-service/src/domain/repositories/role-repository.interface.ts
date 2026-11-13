import { Role } from '../entities/role.entity.js';

export interface ListRolesOptions {
  search?: string;
  isSystem?: boolean;
  page?: number;
  limit?: number;
}

export interface IRoleRepository {
  create(role: Role): Promise<Role>;
  findById(tenantId: string, id: string): Promise<Role | null>;
  findByName(tenantId: string, name: string): Promise<Role | null>;
  list(tenantId: string, options?: ListRolesOptions): Promise<{ items: Role[]; total: number }>;
  update(role: Role): Promise<Role>;
  delete(tenantId: string, id: string): Promise<boolean>;
  existsByName(tenantId: string, name: string, excludeId?: string): Promise<boolean>;
}

