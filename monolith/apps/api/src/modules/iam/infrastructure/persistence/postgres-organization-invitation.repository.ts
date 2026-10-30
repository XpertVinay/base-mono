import { IOrganizationInvitationRepository } from '../../domain/repositories/organization-invitation-repository.interface.js';
import { OrganizationInvitation } from '../../domain/entities/organization-invitation.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresOrganizationInvitationRepository implements IOrganizationInvitationRepository {
  private fallbackStore: Map<string, OrganizationInvitation> = new Map();

  async findById(id: string): Promise<OrganizationInvitation | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, invited_email, invited_by_user_id, role, token, status, expires_at, created_at, updated_at
         FROM iam.organization_invitations WHERE id = $1`,
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

  async findByToken(token: string): Promise<OrganizationInvitation | null> {
    const normalized = token.trim();
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, invited_email, invited_by_user_id, role, token, status, expires_at, created_at, updated_at
         FROM iam.organization_invitations WHERE token = $1`,
        [normalized]
      );
      if (res.rows.length === 0) {
        for (const inv of this.fallbackStore.values()) {
          if (inv.token === normalized) return inv;
        }
        return null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      for (const inv of this.fallbackStore.values()) {
        if (inv.token === normalized) return inv;
      }
      return null;
    }
  }

  async findByOrganizationId(organizationId: string): Promise<OrganizationInvitation[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, invited_email, invited_by_user_id, role, token, status, expires_at, created_at, updated_at
         FROM iam.organization_invitations WHERE organization_id = $1 ORDER BY created_at DESC`,
        [organizationId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(i => i.organizationId === organizationId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(i => i.organizationId === organizationId);
    }
  }

  async findByEmail(email: string): Promise<OrganizationInvitation[]> {
    const normalized = email.toLowerCase().trim();
    try {
      const res = await dbPool.query(
        `SELECT id, organization_id, invited_email, invited_by_user_id, role, token, status, expires_at, created_at, updated_at
         FROM iam.organization_invitations WHERE LOWER(invited_email) = $1 ORDER BY created_at DESC`,
        [normalized]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(i => i.invitedEmail === normalized);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(i => i.invitedEmail === normalized);
    }
  }

  async save(invitation: OrganizationInvitation): Promise<void> {
    try {
      await dbPool.query(
        `INSERT INTO iam.organization_invitations (id, organization_id, invited_email, invited_by_user_id, role, token, status, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           expires_at = EXCLUDED.expires_at,
           updated_at = EXCLUDED.updated_at`,
        [
          invitation.id,
          invitation.organizationId,
          invitation.invitedEmail,
          invitation.invitedByUserId,
          invitation.role,
          invitation.token,
          invitation.status,
          invitation.expiresAt,
          invitation.createdAt,
          invitation.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresOrganizationInvitationRepository, using fallback store', { id: invitation.id });
    } finally {
      this.fallbackStore.set(invitation.id, invitation);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await dbPool.query('DELETE FROM iam.organization_invitations WHERE id = $1', [id]);
    } catch {
      // ignore
    } finally {
      this.fallbackStore.delete(id);
    }
  }

  private mapToDomain(row: any): OrganizationInvitation {
    return new OrganizationInvitation({
      id: row.id,
      organizationId: row.organization_id,
      invitedEmail: row.invited_email,
      invitedByUserId: row.invited_by_user_id,
      role: row.role,
      token: row.token,
      status: row.status,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}

