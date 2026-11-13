import { IPermissionRepository } from '../../domain/repositories/permission-repository.interface.js';
import { Permission } from '../../domain/entities/permission.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresPermissionRepository implements IPermissionRepository {
  async create(permission: Permission): Promise<Permission> {
    await dbPool.query(
      `INSERT INTO rbac.permissions (id, name, category, description, is_system, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        permission.id,
        permission.name,
        permission.category,
        permission.description,
        permission.isSystem,
        permission.createdAt,
        permission.updatedAt
      ]
    );
    return permission;
  }

  async findById(id: string): Promise<Permission | null> {
    const res = await dbPool.query(
      `SELECT id, name, category, description, is_system, created_at, updated_at
       FROM rbac.permissions
       WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToEntity(res.rows[0]);
  }

  async findByName(name: string): Promise<Permission | null> {
    const res = await dbPool.query(
      `SELECT id, name, category, description, is_system, created_at, updated_at
       FROM rbac.permissions
       WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToEntity(res.rows[0]);
  }

  async list(category?: string): Promise<Permission[]> {
    let query = `SELECT id, name, category, description, is_system, created_at, updated_at
                 FROM rbac.permissions`;
    const params: any[] = [];
    if (category) {
      query += ` WHERE LOWER(category) = LOWER($1)`;
      params.push(category);
    }
    query += ` ORDER BY category ASC, name ASC`;

    const res = await dbPool.query(query, params);
    return res.rows.map(this.mapRowToEntity);
  }

  async listCategories(): Promise<string[]> {
    const res = await dbPool.query(
      `SELECT DISTINCT category FROM rbac.permissions ORDER BY category ASC`
    );
    return res.rows.map(r => r.category);
  }

  async listByNames(names: string[]): Promise<Permission[]> {
    if (!names || names.length === 0) return [];
    const lowerNames = names.map(n => n.toLowerCase());
    const res = await dbPool.query(
      `SELECT id, name, category, description, is_system, created_at, updated_at
       FROM rbac.permissions
       WHERE LOWER(name) = ANY($1)`,
      [lowerNames]
    );
    return res.rows.map(this.mapRowToEntity);
  }

  async update(permission: Permission): Promise<Permission> {
    await dbPool.query(
      `UPDATE rbac.permissions
       SET category = $1, description = $2, updated_at = $3
       WHERE id = $4`,
      [permission.category, permission.description, permission.updatedAt, permission.id]
    );
    return permission;
  }

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM rbac.permissions WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    let query = `SELECT 1 FROM rbac.permissions WHERE LOWER(name) = LOWER($1)`;
    const params: any[] = [name];
    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }
    const res = await dbPool.query(query, params);
    return res.rows.length > 0;
  }

  private mapRowToEntity(row: any): Permission {
    return new Permission({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      isSystem: row.is_system,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}

