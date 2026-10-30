-- =========================================================================
-- 006_iam_organizations_and_memberships.sql
-- Multi-Tenant Organization and Membership Management (Sprint 03)
-- =========================================================================

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS iam.organizations (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'PROPERTY_MANAGEMENT',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    owner_user_id VARCHAR(36) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_organizations_slug ON iam.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_iam_organizations_owner ON iam.organizations(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_iam_organizations_status ON iam.organizations(status);

-- 2. Organization Memberships Table
CREATE TABLE IF NOT EXISTS iam.organization_memberships (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_iam_org_memberships_user ON iam.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_iam_org_memberships_org ON iam.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_iam_org_memberships_status ON iam.organization_memberships(status);

-- 3. Organization Invitations Table
CREATE TABLE IF NOT EXISTS iam.organization_invitations (
    id VARCHAR(36) PRIMARY KEY,
    organization_id VARCHAR(36) NOT NULL,
    invited_email VARCHAR(255) NOT NULL,
    invited_by_user_id VARCHAR(36) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_org_invitations_token ON iam.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_iam_org_invitations_email ON iam.organization_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_iam_org_invitations_org ON iam.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_iam_org_invitations_status ON iam.organization_invitations(status);

