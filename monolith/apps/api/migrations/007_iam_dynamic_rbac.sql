-- =========================================================================
-- 007_iam_dynamic_rbac.sql
-- Dynamic Role-Based Access Control (RBAC) & Tenant-Scoped Authorization (Sprint 04)
-- =========================================================================

-- 1. Granular Platform Permissions Table
CREATE TABLE IF NOT EXISTS iam.permissions (
    code VARCHAR(64) PRIMARY KEY,
    domain VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iam_permissions_domain ON iam.permissions(domain);

-- 2. Seed Baseline Domain Permissions
INSERT INTO iam.permissions (code, domain, description)
VALUES
    -- IAM / Tenant
    ('iam:members:read', 'iam', 'View organization members and invitations'),
    ('iam:members:invite', 'iam', 'Invite new members to the organization'),
    ('iam:members:manage', 'iam', 'Update roles or remove organization members'),
    ('iam:org:update', 'iam', 'Update organization profile and settings'),

    -- Property
    ('property:create', 'property', 'Register new property assets'),
    ('property:read', 'property', 'View property details and portfolios'),
    ('property:update', 'property', 'Update property information and configurations'),
    ('property:delete', 'property', 'Archive or delete property assets'),
    ('property:verify', 'property', 'Perform legal and physical property verification'),

    -- Caretaking
    ('caretaking:assign', 'caretaking', 'Assign caretakers to property assets'),
    ('caretaking:revoke', 'caretaking', 'Revoke caretaker property assignments'),
    ('caretaking:inspect', 'caretaking', 'Submit physical inspection reports'),
    ('caretaking:threshold:set', 'caretaking', 'Set caretaker delegation spending limits'),

    -- Maintenance
    ('maintenance:ticket:create', 'maintenance', 'Create maintenance work orders'),
    ('maintenance:ticket:update', 'maintenance', 'Update status of maintenance requests'),
    ('maintenance:quote:approve', 'maintenance', 'Approve contractor quotations'),
    ('maintenance:p1:mobilize', 'maintenance', 'Authorize P1 emergency float escrow mobilization'),

    -- Finance
    ('finance:ledger:read', 'finance', 'View financial ledgers and statements'),
    ('finance:expense:submit', 'finance', 'Submit expense reimbursement requests'),
    ('finance:expense:approve', 'finance', 'Approve vendor invoices and caretaker expenses'),
    ('finance:disburse', 'finance', 'Authorize fund disbursement and payouts'),

    -- Rental
    ('rental:listing:create', 'rental', 'Create rental listings'),
    ('rental:listing:publish', 'rental', 'Publish rental listings publicly'),
    ('rental:lease:sign', 'rental', 'Execute and sign lease agreements'),

    -- Document
    ('document:upload', 'document', 'Upload legal documents to custody vault'),
    ('document:read', 'document', 'Read and download stored documents'),
    ('document:verify_legal', 'document', 'Dual-key legal verification approval'),
    ('document:reject', 'document', 'Reject invalid or unverified documents')
ON CONFLICT (code) DO NOTHING;

-- 3. Tenant-Scoped Roles Table
CREATE TABLE IF NOT EXISTS iam.tenant_roles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_role_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_iam_tenant_roles_tenant ON iam.tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iam_tenant_roles_name ON iam.tenant_roles(name);

-- 4. Tenant Role to Permission Junction Table
CREATE TABLE IF NOT EXISTS iam.tenant_role_permissions (
    role_id VARCHAR(36) NOT NULL REFERENCES iam.tenant_roles(id) ON DELETE CASCADE,
    permission_code VARCHAR(64) NOT NULL REFERENCES iam.permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_iam_role_perms_code ON iam.tenant_role_permissions(permission_code);

-- 5. Extend Organization Memberships with Optional Dynamic Role Foreign Key
ALTER TABLE iam.organization_memberships
ADD COLUMN IF NOT EXISTS tenant_role_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_iam_org_memberships_tenant_role ON iam.organization_memberships(tenant_role_id);

-- 6. Register High-Security Routes in MFA Protected Routes Table
INSERT INTO iam.mfa_protected_routes (id, method, path_pattern, description, reverification_mode, is_active)
VALUES
    ('mfa-route-finance-disburse', 'POST', '/api/finance/disburse', 'Authorizing fund disbursement and payouts requires MFA re-authentication', 'EVERY_TIME', TRUE),
    ('mfa-route-org-members-manage', '*', '/api/iam/organizations/*/members*', 'Managing tenant membership roles and assignments', 'SESSION_24H', TRUE)
ON CONFLICT (path_pattern) DO NOTHING;
