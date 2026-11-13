import { ISsoHandoffRepository } from '../../domain/repositories/sso-handoff-repository.interface.js';
import { SsoHandoffCode } from '../../domain/entities/sso-handoff-code.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresSsoHandoffRepository implements ISsoHandoffRepository {
  async save(handoff: SsoHandoffCode): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.sso_handoff_codes (
        code, session_id, tenant_id, user_id, target_service, scope,
        code_challenge, redirect_uri, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        handoff.code,
        handoff.sessionId,
        handoff.tenantId,
        handoff.userId,
        handoff.targetService,
        handoff.scope ?? null,
        handoff.codeChallenge ?? null,
        handoff.redirectUri ?? null,
        handoff.expiresAt,
        handoff.createdAt
      ]
    );
  }

  async consume(code: string): Promise<SsoHandoffCode | null> {
    const res = await dbPool.query(
      `UPDATE iam.sso_handoff_codes
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE code = $1 AND consumed_at IS NULL
       RETURNING *`,
      [code]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      code: row.code,
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      targetService: row.target_service,
      scope: row.scope || undefined,
      codeChallenge: row.code_challenge || undefined,
      redirectUri: row.redirect_uri || undefined,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }

  async pruneExpired(): Promise<number> {
    const res = await dbPool.query(
      `DELETE FROM iam.sso_handoff_codes WHERE expires_at < CURRENT_TIMESTAMP`
    );
    return res.rowCount || 0;
  }
}

