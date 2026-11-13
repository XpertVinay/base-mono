import { IOidcAuthStateRepository } from '../../domain/repositories/oidc-auth-state-repository.interface.js';
import { OidcAuthState } from '../../domain/entities/oidc-auth-state.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresOidcAuthStateRepository implements IOidcAuthStateRepository {
  async save(state: OidcAuthState): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.oidc_auth_states (
        state, tenant_id, provider_id, nonce, code_verifier, redirect_uri,
        client_redirect_url, link_user_id, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        state.state,
        state.tenantId,
        state.providerId,
        state.nonce,
        state.codeVerifier,
        state.redirectUri,
        state.clientRedirectUrl ?? null,
        state.linkUserId ?? null,
        state.expiresAt,
        state.createdAt
      ]
    );
  }

  /**
   * Atomically consumes an OIDC state (single-use) to prevent replay & CSRF attacks.
   */
  async consume(stateValue: string): Promise<OidcAuthState | null> {
    const res = await dbPool.query(
      `UPDATE iam.oidc_auth_states
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE state = $1 AND consumed_at IS NULL
       RETURNING *`,
      [stateValue]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      state: row.state,
      tenantId: row.tenant_id,
      providerId: row.provider_id,
      nonce: row.nonce,
      codeVerifier: row.code_verifier,
      redirectUri: row.redirect_uri,
      clientRedirectUrl: row.client_redirect_url || undefined,
      linkUserId: row.link_user_id || undefined,
      expiresAt: new Date(row.expires_at),
      consumedAt: row.consumed_at ? new Date(row.consumed_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }

  async pruneExpired(): Promise<number> {
    const res = await dbPool.query(
      `DELETE FROM iam.oidc_auth_states WHERE expires_at < CURRENT_TIMESTAMP`
    );
    return res.rowCount || 0;
  }
}

