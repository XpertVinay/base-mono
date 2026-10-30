-- =========================================================================
-- 005_iam_mfa_and_audit_logging.sql
-- IAM Multi-Factor Authentication (MFA), SSO & Immutable Audit Logging
-- =========================================================================

-- 1. Extend iam.users with MFA credentials and SSO linkage
ALTER TABLE iam.users
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS mfa_last_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS sso_subject_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_iam_users_sso ON iam.users(sso_provider, sso_subject_id);
CREATE INDEX IF NOT EXISTS idx_iam_users_mfa ON iam.users(mfa_enabled);

-- 2. Audit Logging Table for authentication, MFA verification, and route security
CREATE TABLE IF NOT EXISTS iam.audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    event_type VARCHAR(100) NOT NULL,
    ip_address VARCHAR(100),
    user_agent VARCHAR(500),
    details JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_audit_logs_user ON iam.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_iam_audit_logs_event ON iam.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_iam_audit_logs_created ON iam.audit_logs(created_at);

-- 3. Database-Configured MFA Protected Routes for Strict Re-verification
CREATE TABLE IF NOT EXISTS iam.mfa_protected_routes (
    id VARCHAR(36) PRIMARY KEY,
    method VARCHAR(10) NOT NULL DEFAULT '*',
    path_pattern VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    reverification_mode VARCHAR(50) NOT NULL DEFAULT 'SESSION_24H',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_mfa_routes_active ON iam.mfa_protected_routes(is_active);
CREATE INDEX IF NOT EXISTS idx_iam_mfa_routes_pattern ON iam.mfa_protected_routes(path_pattern);

-- 4. Seed Default Critical Protected Routes
INSERT INTO iam.mfa_protected_routes (id, method, path_pattern, description, reverification_mode, is_active)
VALUES
    ('mfa-route-sensitive-op', '*', '/api/iam/mfa/sensitive-operation', 'High-security operation requiring active 24h MFA verification', 'SESSION_24H', TRUE),
    ('mfa-route-strict-action', '*', '/api/iam/mfa/strict-action', 'Critical administrative action requiring immediate MFA re-authentication every time', 'EVERY_TIME', TRUE),
    ('mfa-route-pwd', 'POST', '/api/iam/me/password', 'Credential and password alteration', 'EVERY_TIME', TRUE),
    ('mfa-route-mfa-disable', 'POST', '/api/iam/mfa/disable', 'MFA deactivation requires immediate re-authentication', 'EVERY_TIME', TRUE)
ON CONFLICT (path_pattern) DO NOTHING;
