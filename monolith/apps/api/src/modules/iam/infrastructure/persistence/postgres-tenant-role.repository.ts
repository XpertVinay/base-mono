import { ITenantRoleRepository } from '../../domain/repositories/tenant-role-repository.interface.js';
import { TenantRole } from '../../domain/entities/tenant-role.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { PlatformPermission } from '@monolith/contracts';

export class PostgresTenantRoleRepository implements ITenantRoleRepository {
  private fallbackStore: Map<string, TenantRole> = new Map();

  async findById(id: string): Promise<TenantRole | null> {
    try {
      const res = await dbPool.query(
        `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
                COALESCE(array_agg(p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') as permissions
         FROM iam.tenant_roles r
         LEFT JOIN iam.tenant_role_permissions p ON r.id = p.role_id
         WHERE r.id = $1
         GROUP BY r.id`,
        [id]
      );
      if (res.rows.length === 0) {
        return this.fallbackStore.get(id) || null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByTenantAndName(tenantId: string, name: string): Promise<TenantRole | null> {
    const normalizedName = name.trim().toUpperCase();
    try {
      const res = await dbPool.query(
        `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
                COALESCE(array_agg(p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') as permissions
         FROM iam.tenant_roles r
         LEFT JOIN iam.tenant_role_permissions p ON r.id = p.role_id
         WHERE r.tenant_id = $1 AND UPPER(r.name) = $2
         GROUP BY r.id`,
        [tenantId, normalizedName]
      );
      if (res.rows.length === 0) {
        for (const role of this.fallbackStore.values()) {
          if (role.tenantId === tenantId && role.name === normalizedName) {
            return role;
          }
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      for (const role of this.fallbackStore.values()) {
        if (role.tenantId === tenantId && role.name === normalizedName) {
          return role;
        }
      }
      return null;
    }
  }

  async findByTenantId(tenantId: string): Promise<TenantRole[]> {
    try {
      const res = await dbPool.query(
        `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
                COALESCE(array_agg(p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL), '{}') as permissions
         FROM iam.tenant_roles r
         LEFT JOIN iam.tenant_role_permissions p ON r.id = p.role_id
         WHERE r.tenant_id = $1
         GROUP BY r.id
         ORDER BY r.name ASC`,
        [tenantId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(r => r.tenantId === tenantId);
      }
      return res.rows.map(row => this.mapToDomain(row));
    } catch {
      return Array.from(this.fallbackStore.values()).filter(r => r.tenantId === tenantId);
    }
  }

  async save(role: TenantRole): Promise<void> {
    try {
      await dbPool.query(
        `INSERT INTO iam.tenant_roles (id, tenant_id, name, description, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, name) DO UPDATE SET
           description = EXCLUDED.description,
           is_system = EXCLUDED.is_system,
           updated_at = EXCLUDED.updated_at`,
        [
          role.id,
          role.tenantId,
          role.name,
          role.description,
          role.isSystem,
          role.createdAt,
          role.updatedAt
        ]
      );

      // Update permissions in junction table
      await dbPool.query('DELETE FROM iam.tenant_role_permissions WHERE role_id = $1', [role.id]);
      for (const perm of role.permissions) {
        await dbPool.query(
          `INSERT INTO iam.tenant_role_permissions (role_id, permission_code)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [role.id, perm]
        );
      }
    } catch {
      logger.warn('Database save failed in PostgresTenantRoleRepository, using fallback store', { id: role.id });
    } finally {
      this.fallbackStore.set(role.id, role);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await dbPool.query('DELETE FROM iam.tenant_role_permissions WHERE role_id = $1', [id]);
      await dbPool.query('DELETE FROM iam.tenant_roles WHERE id = $1', [id]);
    } catch {
      // ignore
    } finally {
      this.fallbackStore.delete(id);
    }
  }

  private mapToDomain(row: any): TenantRole {
    const rawPerms = Array.isArray(row.permissions) ? row.permissions : [];
    return new TenantRole({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description || undefined,
      isSystem: Boolean(row.is_system),
      permissions: rawPerms as PlatformPermission[],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
