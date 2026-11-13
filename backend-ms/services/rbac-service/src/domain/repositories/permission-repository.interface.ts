import { Permission } from '../entities/permission.entity.js';

export interface IPermissionRepository {
  create(permission: Permission): Promise<Permission>;
  findById(id: string): Promise<Permission | null>;
  findByName(name: string): Promise<Permission | null>;
  list(category?: string): Promise<Permission[]>;
  listCategories(): Promise<string[]>;
  listByNames(names: string[]): Promise<Permission[]>;
  update(permission: Permission): Promise<Permission>;
  delete(id: string): Promise<boolean>;
  existsByName(name: string, excludeId?: string): Promise<boolean>;
}

