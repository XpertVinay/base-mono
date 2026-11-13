import { User } from '../entities/user.entity.js';

export interface UserFilterParams {
  tenantId?: string;
  role?: string;
  isActive?: boolean;
  search?: string;
  authMethod?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'email' | 'name' | 'role';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedUsersResult {
  users: User[];
  total: number;
}

export interface IUserRepository {
  findById(id: string, tenantId?: string): Promise<User | null>;
  findByEmail(email: string, tenantId?: string): Promise<User | null>;
  findMany(filters: UserFilterParams): Promise<PaginatedUsersResult>;
  save(user: User): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
  countByRole(role: string, tenantId?: string): Promise<number>;
}
