import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { SsoSession } from '../../domain/entities/sso-session.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSsoSessionRepository implements ISsoSessionRepository {
  async save(session: SsoSession): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.sso_sessions (
        id, tenant_id, tenant_slug, user_id, auth_method, provider_id, provider_slug,
        federated_sub, id_token_hint_encrypted, refresh_token_jti, expires_at,
        revoked_at, revoked_reason, last_activity_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        session.id,
        session.tenantId,
        session.tenantSlug ?? null,
        session.userId,
        session.authMethod,
        session.providerId ?? null,
        session.providerSlug ?? null,
        session.federatedSub ?? null,
        session.idTokenHintEncrypted ?? null,
        session.refreshTokenJti,
        session.expiresAt,
        session.revokedAt ?? null,
        session.revokedReason ?? null,
        session.lastActivityAt,
        session.createdAt
      ]
    );
  }

  async findById(sid: string): Promise<SsoSession | null> {
    const res = await dbPool.query(`SELECT * FROM iam.sso_sessions WHERE id = $1`, [sid]);
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async update(session: SsoSession): Promise<void> {
    await dbPool.query(
      `UPDATE iam.sso_sessions SET
        refresh_token_jti = $2,
        revoked_at = $3,
        revoked_reason = $4,
        last_activity_at = $5
       WHERE id = $1`,
      [
        session.id,
        session.refreshTokenJti,
        session.revokedAt ?? null,
        session.revokedReason ?? null,
        session.lastActivityAt
      ]
    );
  }

  async revokeById(sid: string, reason: string = 'User initiated logout'): Promise<boolean> {
    const res = await dbPool.query(
      `UPDATE iam.sso_sessions
       SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = $2
       WHERE id = $1 AND revoked_at IS NULL`,
      [sid, reason]
    );
    return (res.rowCount || 0) > 0;
  }

  async revokeByUser(userId: string, tenantId: string, reason: string = 'User initiated global logout'): Promise<number> {
    const res = await dbPool.query(
      `UPDATE iam.sso_sessions
       SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = $3
       WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
      [userId, tenantId, reason]
    );
    return res.rowCount || 0;
  }

  async revokeByFederatedSubject(
    tenantId: string,
    providerId: string,
    subject: string,
    reason: string = 'IdP back-channel logout'
  ): Promise<number> {
    const res = await dbPool.query(
      `UPDATE iam.sso_sessions
       SET revoked_at = CURRENT_TIMESTAMP, revoked_reason = $4
       WHERE tenant_id = $1 AND provider_id = $2 AND federated_sub = $3 AND revoked_at IS NULL`,
      [tenantId, providerId, subject, reason]
    );
    return res.rowCount || 0;
  }

  async isRevoked(sid: string): Promise<boolean> {
    const res = await dbPool.query(
      `SELECT revoked_at, expires_at FROM iam.sso_sessions WHERE id = $1`,
      [sid]
    );
    if (res.rows.length === 0) return false;
    const row = res.rows[0];
    if (row.revoked_at) return true;
    return new Date(row.expires_at).getTime() <= Date.now();
  }

  async listActiveByUser(userId: string, tenantId: string): Promise<SsoSession[]> {
    const res = await dbPool.query(
      `SELECT * FROM iam.sso_sessions
       WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC`,
      [userId, tenantId]
    );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  private mapToDomain(row: any): SsoSession {
    return SsoSession.reconstitute(
      {
        tenantId: row.tenant_id,
        tenantSlug: row.tenant_slug || undefined,
        userId: row.user_id,
        authMethod: row.auth_method,
        providerId: row.provider_id || undefined,
        providerSlug: row.provider_slug || undefined,
        federatedSub: row.federated_sub || undefined,
        idTokenHintEncrypted: row.id_token_hint_encrypted || undefined,
        refreshTokenJti: row.refresh_token_jti,
        expiresAt: new Date(row.expires_at),
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
        revokedReason: row.revoked_reason || undefined,
        lastActivityAt: new Date(row.last_activity_at),
        createdAt: new Date(row.created_at)
      },
      row.id
    );
  }
}

