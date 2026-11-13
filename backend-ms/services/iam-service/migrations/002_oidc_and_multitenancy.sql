-- ==========================================================
-- IAM Service Migration 002: Multi-Tenancy & OIDC Federated Login
-- ==========================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS iam.tenants (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{"allowLocalLogin":true,"allowFederatedLogin":true,"autoProvisionUsers":true,"defaultRole":"USER","allowedEmailDomains":[],"sessionTtlSeconds":3600}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_tenants_slug ON iam.tenants(slug);

-- Seed default tenant so existing single-tenant workflows continue seamlessly
INSERT INTO iam.tenants (id, slug, name, is_active)
VALUES ('default', 'default', 'Default Tenant', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Extend iam.users for multi-tenancy and passwordless federated users
ALTER TABLE iam.users
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS auth_method VARCHAR(32) NOT NULL DEFAULT 'LOCAL';

ALTER TABLE iam.users
    ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_iam_users_tenant'
    ) THEN
        ALTER TABLE iam.users
            ADD CONSTRAINT fk_iam_users_tenant FOREIGN KEY (tenant_id) REFERENCES iam.tenants(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Drop global unique constraint on email if it exists, and enforce per-tenant email uniqueness
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT c.conname INTO v_constraint_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'iam'
      AND t.relname = 'users'
      AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = t.oid AND a.attnum = c.conkey[1]) = 'email';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE iam.users DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_iam_users_tenant_email ON iam.users(tenant_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_iam_users_tenant_id ON iam.users(tenant_id);

-- 3. OIDC Identity Providers per Tenant
CREATE TABLE IF NOT EXISTS iam.oidc_providers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    provider_type VARCHAR(50) NOT NULL DEFAULT 'GENERIC_OIDC',
    display_name VARCHAR(255) NOT NULL,
    issuer_url TEXT NOT NULL,
    authorization_endpoint TEXT,
    token_endpoint TEXT,
    userinfo_endpoint TEXT,
    jwks_uri TEXT,
    client_id VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT,
    redirect_uri TEXT NOT NULL,
    scopes VARCHAR(500) NOT NULL DEFAULT 'openid profile email',
    use_pkce BOOLEAN NOT NULL DEFAULT TRUE,
    auto_provision BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
    claim_mapping JSONB NOT NULL DEFAULT '{"sub":"sub","email":"email","name":"name","role":"role","groups":"groups","emailVerified":"email_verified"}'::jsonb,
    role_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    extra_auth_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_iam_oidc_providers_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_iam_oidc_providers_tenant ON iam.oidc_providers(tenant_id, is_enabled);

-- 4. Federated Identities linked to IAM Users
CREATE TABLE IF NOT EXISTS iam.federated_identities (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
    provider_id VARCHAR(36) NOT NULL REFERENCES iam.oidc_providers(id) ON DELETE CASCADE,
    provider_slug VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_iam_federated_identities_subject UNIQUE (tenant_id, provider_id, subject)
);

CREATE INDEX IF NOT EXISTS idx_iam_federated_user ON iam.federated_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_iam_federated_tenant_sub ON iam.federated_identities(tenant_id, provider_id, subject);

-- 5. Ephemeral OIDC Auth States (PKCE + State + Nonce)
CREATE TABLE IF NOT EXISTS iam.oidc_auth_states (
    state VARCHAR(128) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES iam.tenants(id) ON DELETE CASCADE,
    provider_id VARCHAR(36) NOT NULL REFERENCES iam.oidc_providers(id) ON DELETE CASCADE,
    nonce VARCHAR(128) NOT NULL,
    code_verifier VARCHAR(256) NOT NULL,
    redirect_uri TEXT NOT NULL,
    client_redirect_url TEXT,
    link_user_id VARCHAR(36),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_oidc_states_expires ON iam.oidc_auth_states(expires_at);

