import { IRoleRepository, ListRolesOptions } from '../../domain/repositories/role-repository.interface.js';
import { Role } from '../../domain/entities/role.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresRoleRepository implements IRoleRepository {
  async create(role: Role): Promise<Role> {
    const client = await dbPool.getPool().connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO rbac.roles (id, tenant_id, name, description, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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

      if (role.permissions.length > 0) {
        // Resolve permission ids from names
        const permRes = await client.query(
          `SELECT id, name FROM rbac.permissions WHERE LOWER(name) = ANY($1)`,
          [role.permissions.map(p => p.toLowerCase())]
        );

        for (const row of permRes.rows) {
          await client.query(
            `INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [role.id, row.id, role.tenantId]
          );
        }
      }

      await client.query('COMMIT');
      return role;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(tenantId: string, id: string): Promise<Role | null> {
    const res = await dbPool.query(
      `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
              COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
       FROM rbac.roles r
       LEFT JOIN rbac.role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
       LEFT JOIN rbac.permissions p ON p.id = rp.permission_id
       WHERE r.id = $1 AND (r.tenant_id = $2 OR r.tenant_id = 'default')
       GROUP BY r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at`,
      [id, tenantId]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToEntity(res.rows[0]);
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    const res = await dbPool.query(
      `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
              COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
       FROM rbac.roles r
       LEFT JOIN rbac.role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
       LEFT JOIN rbac.permissions p ON p.id = rp.permission_id
       WHERE UPPER(r.name) = UPPER($1) AND (r.tenant_id = $2 OR r.tenant_id = 'default')
       GROUP BY r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at
       ORDER BY CASE WHEN r.tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [name, tenantId]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToEntity(res.rows[0]);
  }

  async list(tenantId: string, options?: ListRolesOptions): Promise<{ items: Role[]; total: number }> {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 20));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE (r.tenant_id = $1 OR r.tenant_id = 'default')`;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (options?.search) {
      whereClause += ` AND (r.name ILIKE $${paramIdx} OR r.description ILIKE $${paramIdx})`;
      params.push(`%${options.search}%`);
      paramIdx++;
    }

    if (options?.isSystem !== undefined) {
      whereClause += ` AND r.is_system = $${paramIdx}`;
      params.push(options.isSystem);
      paramIdx++;
    }

    const countRes = await dbPool.query(
      `SELECT COUNT(DISTINCT r.id) as total FROM rbac.roles r ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const queryParams = [...params, limit, offset];
    const dataRes = await dbPool.query(
      `SELECT r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
              COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.name IS NOT NULL), '{}') as permissions
       FROM rbac.roles r
       LEFT JOIN rbac.role_permissions rp ON rp.role_id = r.id AND rp.tenant_id = r.tenant_id
       LEFT JOIN rbac.permissions p ON p.id = rp.permission_id
       ${whereClause}
       GROUP BY r.id, r.tenant_id, r.name, r.description, r.is_system, r.created_at, r.updated_at
       ORDER BY r.is_system DESC, r.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      queryParams
    );

    return {
      items: dataRes.rows.map(this.mapRowToEntity),
      total
    };
  }

  async update(role: Role): Promise<Role> {
    const client = await dbPool.getPool().connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE rbac.roles
         SET name = $1, description = $2, updated_at = $3
         WHERE id = $4 AND (tenant_id = $5 OR tenant_id = 'default')`,
        [role.name, role.description, role.updatedAt, role.id, role.tenantId]
      );

      // Replace role_permissions
      await client.query(
        `DELETE FROM rbac.role_permissions WHERE role_id = $1`,
        [role.id]
      );

      if (role.permissions.length > 0) {
        const permRes = await client.query(
          `SELECT id, name FROM rbac.permissions WHERE LOWER(name) = ANY($1)`,
          [role.permissions.map(p => p.toLowerCase())]
        );

        for (const row of permRes.rows) {
          await client.query(
            `INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [role.id, row.id, role.tenantId]
          );
        }
      }

      await client.query('COMMIT');
      return role;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM rbac.roles WHERE id = $1 AND tenant_id = $2 AND is_system = FALSE`,
      [id, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async existsByName(tenantId: string, name: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT 1 FROM rbac.roles WHERE UPPER(name) = UPPER($1) AND (tenant_id = $2 OR tenant_id = 'default')`;
    const params: any[] = [name, tenantId];
    if (excludeId) {
      query += ` AND id != $3`;
      params.push(excludeId);
    }
    const res = await dbPool.query(query, params);
    return res.rows.length > 0;
  }

  private mapRowToEntity(row: any): Role {
    return new Role({
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      isSystem: row.is_system,
      permissions: row.permissions || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}

