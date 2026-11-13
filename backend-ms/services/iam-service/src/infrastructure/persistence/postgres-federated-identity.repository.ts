import { IFederatedIdentityRepository } from '../../domain/repositories/federated-identity-repository.interface.js';
import { FederatedIdentity } from '../../domain/entities/federated-identity.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresFederatedIdentityRepository implements IFederatedIdentityRepository {
  async findById(id: string): Promise<FederatedIdentity | null> {
    const res = await dbPool.query('SELECT * FROM iam.federated_identities WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findBySubject(tenantId: string, providerId: string, subject: string): Promise<FederatedIdentity | null> {
    const res = await dbPool.query(
      `SELECT * FROM iam.federated_identities
       WHERE tenant_id = $1 AND provider_id = $2 AND subject = $3`,
      [tenantId, providerId, subject]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByUserId(userId: string, tenantId?: string): Promise<FederatedIdentity[]> {
    const res = tenantId
      ? await dbPool.query(
          `SELECT * FROM iam.federated_identities WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
          [userId, tenantId]
        )
      : await dbPool.query(
          `SELECT * FROM iam.federated_identities WHERE user_id = $1 ORDER BY created_at DESC`,
          [userId]
        );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  async save(identity: FederatedIdentity): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.federated_identities (
        id, tenant_id, user_id, provider_id, provider_slug, subject, email, profile, last_login_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
      [
        identity.id,
        identity.tenantId,
        identity.userId,
        identity.providerId,
        identity.providerSlug,
        identity.subject,
        identity.email ?? null,
        JSON.stringify(identity.profile),
        identity.lastLoginAt ?? null,
        identity.createdAt,
        identity.updatedAt
      ]
    );
  }

  async update(identity: FederatedIdentity): Promise<void> {
    await dbPool.query(
      `UPDATE iam.federated_identities
       SET email = $2, profile = $3::jsonb, last_login_at = $4, updated_at = $5
       WHERE id = $1`,
      [
        identity.id,
        identity.email ?? null,
        JSON.stringify(identity.profile),
        identity.lastLoginAt ?? null,
        identity.updatedAt
      ]
    );
  }

  async deleteById(id: string, userId: string, tenantId: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM iam.federated_identities WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
      [id, userId, tenantId]
    );
    return (res.rowCount || 0) > 0;
  }

  private mapToDomain(row: any): FederatedIdentity {
    return FederatedIdentity.reconstitute(
      {
        tenantId: row.tenant_id,
        userId: row.user_id,
        providerId: row.provider_id,
        providerSlug: row.provider_slug,
        subject: row.subject,
        email: row.email || undefined,
        profile: typeof row.profile === 'string' ? JSON.parse(row.profile) : (row.profile || {}),
        lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}

