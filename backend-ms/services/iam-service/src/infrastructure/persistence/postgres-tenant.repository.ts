import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { Tenant } from '../../domain/entities/tenant.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresTenantRepository implements ITenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    const res = await dbPool.query(
      'SELECT id, slug, name, is_active, config, created_at, updated_at FROM iam.tenants WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const res = await dbPool.query(
      'SELECT id, slug, name, is_active, config, created_at, updated_at FROM iam.tenants WHERE LOWER(slug) = LOWER($1)',
      [slug]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByIdOrSlug(idOrSlug: string): Promise<Tenant | null> {
    const res = await dbPool.query(
      'SELECT id, slug, name, is_active, config, created_at, updated_at FROM iam.tenants WHERE id = $1 OR LOWER(slug) = LOWER($1) LIMIT 1',
      [idOrSlug]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async listAll(): Promise<Tenant[]> {
    const res = await dbPool.query(
      'SELECT id, slug, name, is_active, config, created_at, updated_at FROM iam.tenants ORDER BY created_at ASC'
    );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  async save(tenant: Tenant): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.tenants (id, slug, name, is_active, config, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        tenant.id,
        tenant.slug,
        tenant.name,
        tenant.isActive,
        JSON.stringify(tenant.config),
        tenant.createdAt,
        tenant.updatedAt
      ]
    );
  }

  async update(tenant: Tenant): Promise<void> {
    await dbPool.query(
      `UPDATE iam.tenants
       SET name = $2, is_active = $3, config = $4::jsonb, updated_at = $5
       WHERE id = $1`,
      [
        tenant.id,
        tenant.name,
        tenant.isActive,
        JSON.stringify(tenant.config),
        tenant.updatedAt
      ]
    );
  }

  async delete(id: string): Promise<boolean> {
    const res = await dbPool.query(
      'DELETE FROM iam.tenants WHERE id = $1',
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): Tenant {
    return Tenant.reconstitute(
      {
        slug: row.slug,
        name: row.name,
        isActive: row.is_active,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}

