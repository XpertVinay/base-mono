import { IOrganizationRepository } from '../../domain/repositories/organization-repository.interface.js';
import { Organization } from '../../domain/entities/organization.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresOrganizationRepository implements IOrganizationRepository {
  private fallbackStore: Map<string, Organization> = new Map();

  async findById(id: string): Promise<Organization | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, name, slug, type, status, owner_user_id, metadata, created_at, updated_at
         FROM iam.organizations WHERE id = $1`,
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

  async findBySlug(slug: string): Promise<Organization | null> {
    const normalized = slug.toLowerCase().trim();
    try {
      const res = await dbPool.query(
        `SELECT id, name, slug, type, status, owner_user_id, metadata, created_at, updated_at
         FROM iam.organizations WHERE slug = $1`,
        [normalized]
      );
      if (res.rows.length === 0) {
        for (const org of this.fallbackStore.values()) {
          if (org.slug === normalized) return org;
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      for (const org of this.fallbackStore.values()) {
        if (org.slug === normalized) return org;
      }
      return null;
    }
  }

  async findByOwnerId(ownerUserId: string): Promise<Organization[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, name, slug, type, status, owner_user_id, metadata, created_at, updated_at
         FROM iam.organizations WHERE owner_user_id = $1 ORDER BY created_at DESC`,
        [ownerUserId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(o => o.ownerUserId === ownerUserId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(o => o.ownerUserId === ownerUserId);
    }
  }

  async save(organization: Organization): Promise<void> {
    try {
      await dbPool.query(
        `INSERT INTO iam.organizations (id, name, slug, type, status, owner_user_id, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           slug = EXCLUDED.slug,
           type = EXCLUDED.type,
           status = EXCLUDED.status,
           owner_user_id = EXCLUDED.owner_user_id,
           metadata = EXCLUDED.metadata,
           updated_at = EXCLUDED.updated_at`,
        [
          organization.id,
          organization.name,
          organization.slug,
          organization.type,
          organization.status,
          organization.ownerUserId,
          JSON.stringify(organization.metadata),
          organization.createdAt,
          organization.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresOrganizationRepository, using fallback store', { id: organization.id });
    } finally {
      this.fallbackStore.set(organization.id, organization);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await dbPool.query('DELETE FROM iam.organizations WHERE id = $1', [id]);
    } catch {
      // ignore
    } finally {
      this.fallbackStore.delete(id);
    }
  }

  private mapToDomain(row: any): Organization {
    return new Organization({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      status: row.status,
      ownerUserId: row.owner_user_id,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}

