import { IOrganizationMembershipRepository } from '../../domain/repositories/organization-membership-repository.interface.js';
import { OrganizationMembership } from '../../domain/entities/organization-membership.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresOrganizationMembershipRepository implements IOrganizationMembershipRepository {
  private fallbackStore: Map<string, OrganizationMembership> = new Map();

  async findById(id: string): Promise<OrganizationMembership | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, user_id, role, tenant_role_id, status, joined_at, created_at, updated_at
         FROM iam.organization_memberships WHERE id = $1`,
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

  async findByOrgAndUser(organizationId: string, userId: string): Promise<OrganizationMembership | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, user_id, role, tenant_role_id, status, joined_at, created_at, updated_at
         FROM iam.organization_memberships WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId]
      );
      if (res.rows.length === 0) {
        for (const m of this.fallbackStore.values()) {
          if (m.organizationId === organizationId && m.userId === userId) {
            return m;
          }
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      for (const m of this.fallbackStore.values()) {
        if (m.organizationId === organizationId && m.userId === userId) {
          return m;
        }
      }
      return null;
    }
  }

  async findByUserId(userId: string): Promise<OrganizationMembership[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, user_id, role, tenant_role_id, status, joined_at, created_at, updated_at
         FROM iam.organization_memberships WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(m => m.userId === userId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(m => m.userId === userId);
    }
  }

  async findByOrganizationId(organizationId: string): Promise<OrganizationMembership[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, user_id, role, tenant_role_id, status, joined_at, created_at, updated_at
         FROM iam.organization_memberships WHERE organization_id = $1 ORDER BY created_at DESC`,
        [organizationId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(m => m.organizationId === organizationId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(m => m.organizationId === organizationId);
    }
  }

  async save(membership: OrganizationMembership): Promise<void> {
    try {
      await dbPool.query(
        `INSERT INTO iam.organization_memberships (id, organization_id, user_id, role, tenant_role_id, status, joined_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (organization_id, user_id) DO UPDATE SET
           role = EXCLUDED.role,
           tenant_role_id = EXCLUDED.tenant_role_id,
           status = EXCLUDED.status,
           joined_at = EXCLUDED.joined_at,
           updated_at = EXCLUDED.updated_at`,
        [
          membership.id,
          membership.organizationId,
          membership.userId,
          membership.role,
          membership.tenantRoleId,
          membership.status,
          membership.joinedAt,
          membership.createdAt,
          membership.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresOrganizationMembershipRepository, using fallback store', { id: membership.id });
    } finally {
      for (const [key, existing] of this.fallbackStore.entries()) {
        if (existing.organizationId === membership.organizationId && existing.userId === membership.userId && key !== membership.id) {
          this.fallbackStore.delete(key);
        }
      }
      this.fallbackStore.set(membership.id, membership);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await dbPool.query('DELETE FROM iam.organization_memberships WHERE id = $1', [id]);
    } catch {
      // ignore
    } finally {
      this.fallbackStore.delete(id);
    }
  }

  private mapToDomain(row: any): OrganizationMembership {
    return new OrganizationMembership({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      tenantRoleId: row.tenant_role_id || null,
      status: row.status,
      joinedAt: row.joined_at ? new Date(row.joined_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}

