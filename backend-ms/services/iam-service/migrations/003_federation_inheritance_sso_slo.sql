-- =====================================================================
-- IAM Service Migration 003: Provider Inheritance, Approvals, SSO & SLO
-- =====================================================================

-- 1. Extend iam.oidc_providers for OAuth2 / SAML, system-default inheritance & platform approvals
ALTER TABLE iam.oidc_providers
    ADD COLUMN IF NOT EXISTS protocol VARCHAR(32) NOT NULL DEFAULT 'OIDC',
    ADD COLUMN IF NOT EXISTS end_session_endpoint TEXT,
    ADD COLUMN IF NOT EXISTS allowed_redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS inherits_system_config BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_provider_id VARCHAR(36) REFERENCES iam.oidc_providers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(64),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS saml_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_iam_oidc_providers_system_default
    ON iam.oidc_providers(is_system_default, is_enabled, approval_status);

CREATE INDEX IF NOT EXISTS idx_iam_oidc_providers_approval_status
    ON iam.oidc_providers(approval_status);

-- 2. Unified SSO Sessions (supports Secure SSO, Refresh Rotation & Secure SLO revocation)
CREATE TABLE IF NOT EXISTS iam.sso_sessions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
    tenant_slug VARCHAR(100),
    user_id VARCHAR(36) NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    auth_method VARCHAR(32) NOT NULL,
    provider_id VARCHAR(36),
    provider_slug VARCHAR(100),
    federated_sub VARCHAR(255),
    id_token_hint_encrypted TEXT,
    refresh_token_jti VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_reason VARCHAR(255),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_sso_sessions_user ON iam.sso_sessions(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_iam_sso_sessions_fed_sub ON iam.sso_sessions(tenant_id, provider_id, federated_sub);
CREATE INDEX IF NOT EXISTS idx_iam_sso_sessions_expires ON iam.sso_sessions(expires_at);

-- 3. Ephemeral Single-Use Internal SSO Handoff Codes (for cross-service-provider token sharing)
CREATE TABLE IF NOT EXISTS iam.sso_handoff_codes (
    code VARCHAR(128) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL REFERENCES iam.sso_sessions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    target_service VARCHAR(128) NOT NULL,
    scope VARCHAR(500),
    code_challenge VARCHAR(256),
    redirect_uri TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_sso_handoff_expires ON iam.sso_handoff_codes(expires_at);

