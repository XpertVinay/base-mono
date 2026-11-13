import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import { OidcProvider } from '../../domain/entities/oidc-provider.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresOidcProviderRepository implements IOidcProviderRepository {
  async findById(id: string): Promise<OidcProvider | null> {
    const res = await dbPool.query(
      `SELECT * FROM iam.oidc_providers WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findBySlug(tenantId: string, slug: string): Promise<OidcProvider | null> {
    const res = await dbPool.query(
      `SELECT * FROM iam.oidc_providers WHERE tenant_id = $1 AND LOWER(slug) = LOWER($2)`,
      [tenantId, slug]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByIdOrSlug(tenantId: string, idOrSlug: string): Promise<OidcProvider | null> {
    const res = await dbPool.query(
      `SELECT * FROM iam.oidc_providers WHERE tenant_id = $1 AND (id = $2 OR LOWER(slug) = LOWER($2)) LIMIT 1`,
      [tenantId, idOrSlug]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async listByTenant(tenantId: string, onlyEnabled = false): Promise<OidcProvider[]> {
    const res = onlyEnabled
      ? await dbPool.query(
          `SELECT * FROM iam.oidc_providers WHERE tenant_id = $1 AND is_enabled = TRUE ORDER BY created_at ASC`,
          [tenantId]
        )
      : await dbPool.query(
          `SELECT * FROM iam.oidc_providers WHERE tenant_id = $1 ORDER BY created_at ASC`,
          [tenantId]
        );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  async listSystemDefaults(onlyEnabled = false): Promise<OidcProvider[]> {
    const res = onlyEnabled
      ? await dbPool.query(
          `SELECT * FROM iam.oidc_providers WHERE is_system_default = TRUE AND is_enabled = TRUE AND approval_status = 'APPROVED' ORDER BY created_at ASC`
        )
      : await dbPool.query(
          `SELECT * FROM iam.oidc_providers WHERE is_system_default = TRUE ORDER BY created_at ASC`
        );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  async findSystemDefaultBySlug(slug: string): Promise<OidcProvider | null> {
    const res = await dbPool.query(
      `SELECT * FROM iam.oidc_providers WHERE is_system_default = TRUE AND LOWER(slug) = LOWER($1) LIMIT 1`,
      [slug]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async listPendingApprovals(): Promise<OidcProvider[]> {
    const res = await dbPool.query(
      `SELECT * FROM iam.oidc_providers WHERE approval_status = 'PENDING' ORDER BY created_at ASC`
    );
    return res.rows.map((r) => this.mapToDomain(r));
  }

  async save(provider: OidcProvider): Promise<void> {
    await dbPool.query(
      `INSERT INTO iam.oidc_providers (
        id, tenant_id, slug, provider_type, protocol, display_name, issuer_url,
        authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri, end_session_endpoint,
        client_id, client_secret_encrypted, redirect_uri, allowed_redirect_uris, scopes, use_pkce,
        auto_provision, allowed_domains, claim_mapping, role_mapping, extra_auth_params,
        saml_config, is_system_default, inherits_system_config, parent_provider_id,
        approval_status, approved_by, approved_at, rejection_reason,
        is_enabled, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16::jsonb, $17, $18,
        $19, $20::jsonb, $21::jsonb, $22::jsonb, $23::jsonb,
        $24::jsonb, $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33, $34
      )`,
      [
        provider.id,
        provider.tenantId,
        provider.slug,
        provider.providerType,
        provider.protocol,
        provider.displayName,
        provider.issuerUrl,
        provider.authorizationEndpoint ?? null,
        provider.tokenEndpoint ?? null,
        provider.userinfoEndpoint ?? null,
        provider.jwksUri ?? null,
        provider.endSessionEndpoint ?? null,
        provider.clientId,
        provider.clientSecretEncrypted ?? null,
        provider.redirectUri,
        JSON.stringify(provider.allowedRedirectUris || []),
        provider.scopes,
        provider.usePkce,
        provider.autoProvision,
        JSON.stringify(provider.allowedDomains),
        JSON.stringify(provider.claimMapping),
        JSON.stringify(provider.roleMapping),
        JSON.stringify(provider.extraAuthParams),
        JSON.stringify(provider.samlConfig || {}),
        provider.isSystemDefault,
        provider.inheritsSystemConfig,
        provider.parentProviderId ?? null,
        provider.approvalStatus,
        provider.approvedBy ?? null,
        provider.approvedAt ?? null,
        provider.rejectionReason ?? null,
        provider.isEnabled,
        provider.createdAt,
        provider.updatedAt
      ]
    );
  }

  async update(provider: OidcProvider): Promise<void> {
    await dbPool.query(
      `UPDATE iam.oidc_providers SET
        protocol = $2,
        display_name = $3,
        issuer_url = $4,
        authorization_endpoint = $5,
        token_endpoint = $6,
        userinfo_endpoint = $7,
        jwks_uri = $8,
        end_session_endpoint = $9,
        client_id = $10,
        client_secret_encrypted = $11,
        redirect_uri = $12,
        allowed_redirect_uris = $13::jsonb,
        scopes = $14,
        use_pkce = $15,
        auto_provision = $16,
        allowed_domains = $17::jsonb,
        claim_mapping = $18::jsonb,
        role_mapping = $19::jsonb,
        extra_auth_params = $20::jsonb,
        saml_config = $21::jsonb,
        is_system_default = $22,
        inherits_system_config = $23,
        parent_provider_id = $24,
        approval_status = $25,
        approved_by = $26,
        approved_at = $27,
        rejection_reason = $28,
        is_enabled = $29,
        updated_at = $30
      WHERE id = $1 AND tenant_id = $31`,
      [
        provider.id,
        provider.protocol,
        provider.displayName,
        provider.issuerUrl,
        provider.authorizationEndpoint ?? null,
        provider.tokenEndpoint ?? null,
        provider.userinfoEndpoint ?? null,
        provider.jwksUri ?? null,
        provider.endSessionEndpoint ?? null,
        provider.clientId,
        provider.clientSecretEncrypted ?? null,
        provider.redirectUri,
        JSON.stringify(provider.allowedRedirectUris || []),
        provider.scopes,
        provider.usePkce,
        provider.autoProvision,
        JSON.stringify(provider.allowedDomains),
        JSON.stringify(provider.claimMapping),
        JSON.stringify(provider.roleMapping),
        JSON.stringify(provider.extraAuthParams),
        JSON.stringify(provider.samlConfig || {}),
        provider.isSystemDefault,
        provider.inheritsSystemConfig,
        provider.parentProviderId ?? null,
        provider.approvalStatus,
        provider.approvedBy ?? null,
        provider.approvedAt ?? null,
        provider.rejectionReason ?? null,
        provider.isEnabled,
        provider.updatedAt,
        provider.tenantId
      ]
    );
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const res = await dbPool.query(
      `DELETE FROM iam.oidc_providers WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return (res.rowCount || 0) > 0;
  }

  private mapToDomain(row: any): OidcProvider {
    const parseJson = (val: any, fallback: any) =>
      val == null ? fallback : typeof val === 'string' ? JSON.parse(val) : val;

    const samlParsed = parseJson(row.saml_config, {});

    return OidcProvider.reconstitute(
      {
        tenantId: row.tenant_id,
        slug: row.slug,
        providerType: row.provider_type,
        protocol: row.protocol || undefined,
        displayName: row.display_name,
        issuerUrl: row.issuer_url,
        authorizationEndpoint: row.authorization_endpoint || undefined,
        tokenEndpoint: row.token_endpoint || undefined,
        userinfoEndpoint: row.userinfo_endpoint || undefined,
        jwksUri: row.jwks_uri || undefined,
        endSessionEndpoint: row.end_session_endpoint || undefined,
        clientId: row.client_id,
        clientSecretEncrypted: row.client_secret_encrypted || undefined,
        redirectUri: row.redirect_uri,
        allowedRedirectUris: parseJson(row.allowed_redirect_uris, []),
        scopes: row.scopes,
        usePkce: row.use_pkce,
        autoProvision: row.auto_provision,
        allowedDomains: parseJson(row.allowed_domains, []),
        claimMapping: parseJson(row.claim_mapping, {}),
        roleMapping: parseJson(row.role_mapping, {}),
        extraAuthParams: parseJson(row.extra_auth_params, {}),
        samlConfig: samlParsed && Object.keys(samlParsed).length > 0 ? samlParsed : undefined,
        isSystemDefault: Boolean(row.is_system_default),
        inheritsSystemConfig: Boolean(row.inherits_system_config),
        parentProviderId: row.parent_provider_id || undefined,
        approvalStatus: row.approval_status || 'APPROVED',
        approvedBy: row.approved_by || undefined,
        approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
        rejectionReason: row.rejection_reason || undefined,
        isEnabled: row.is_enabled,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}
