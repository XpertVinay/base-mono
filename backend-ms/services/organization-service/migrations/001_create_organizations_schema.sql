-- Schema and Tables for Organization / Tenant Management Service
CREATE SCHEMA IF NOT EXISTS organizations;

CREATE TABLE IF NOT EXISTS organizations.organizations (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    tier VARCHAR(32) NOT NULL DEFAULT 'FREE',
    industry VARCHAR(100),
    tax_id VARCHAR(100),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    address JSONB DEFAULT '{}'::jsonb,
    settings JSONB NOT NULL DEFAULT '{"branding":{"primaryColor":"#2563eb"},"security":{"enforceMfa":false,"sessionTtlSeconds":3600,"allowedEmailDomains":[]},"features":{"auditLogs":true,"sso":false,"customDomain":false},"maxUsers":50,"timezone":"UTC","currency":"USD"}'::jsonb,
    max_users INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations.organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_tier ON organizations.organizations(tier);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations.organizations(created_at DESC);

-- Organization Members
CREATE TABLE IF NOT EXISTS organizations.organization_members (
    id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL REFERENCES organizations.organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_organizations_member_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organizations.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organizations.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organizations.organization_members(role);

-- Seed Default Organization
INSERT INTO organizations.organizations (
    id, slug, name, legal_name, status, tier, industry, contact_email, max_users
)
VALUES (
    'default',
    'default',
    'Default Organization',
    'Default Organization LLC',
    'ACTIVE',
    'ENTERPRISE',
    'enterprise_saas',
    'admin@default.internal',
    10000
)
ON CONFLICT (id) DO NOTHING;
