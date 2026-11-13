import {
  IUserRepository,
  UserFilterParams,
  PaginatedUsersResult
} from '../../domain/repositories/user-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';

export class InMemoryUserRepository implements IUserRepository {
  private readonly items = new Map<string, User>();

  async findById(id: string, tenantId?: string): Promise<User | null> {
    const user = this.items.get(id);
    if (!user) return null;
    if (tenantId && user.tenantId !== tenantId) return null;
    return user;
  }

  async findByEmail(email: string, tenantId?: string): Promise<User | null> {
    const resolvedTenant = tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    return (
      Array.from(this.items.values()).find(
        (u) =>
          u.email.toLowerCase() === email.toLowerCase() &&
          u.tenantId === resolvedTenant
      ) || null
    );
  }

  async findMany(filters: UserFilterParams): Promise<PaginatedUsersResult> {
    let filtered = Array.from(this.items.values());

    if (filters.tenantId) {
      filtered = filtered.filter((u) => u.tenantId === filters.tenantId);
    }

    if (filters.role) {
      filtered = filtered.filter((u) => u.role.toUpperCase() === filters.role!.toUpperCase());
    }

    if (filters.isActive !== undefined) {
      filtered = filtered.filter((u) => u.isActive === filters.isActive);
    }

    if (filters.authMethod) {
      filtered = filtered.filter((u) => u.authMethod.toUpperCase() === filters.authMethod!.toUpperCase());
    }

    if (filters.search && filters.search.trim().length > 0) {
      const q = filters.search.trim().toLowerCase();
      filtered = filtered.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortField = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder?.toUpperCase() === 'ASC' ? 1 : -1;

    filtered.sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const total = filtered.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      users: paginated,
      total
    };
  }

  async save(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async update(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const existing = this.items.get(id);
    if (!existing) return false;
    if (tenantId && existing.tenantId !== tenantId) return false;
    return this.items.delete(id);
  }

  async countByRole(role: string, tenantId?: string): Promise<number> {
    return Array.from(this.items.values()).filter(
      (u) =>
        u.role.toUpperCase() === role.toUpperCase() &&
        u.isActive &&
        (!tenantId || u.tenantId === tenantId)
    ).length;
  }
}

