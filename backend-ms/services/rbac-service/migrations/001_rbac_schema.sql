-- ==========================================================
-- Schema and Tables for Roles & Permissions (RBAC) Service
-- ==========================================================

CREATE SCHEMA IF NOT EXISTS rbac;

-- 1. Permissions Table
CREATE TABLE IF NOT EXISTS rbac.permissions (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(64) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rbac_permissions_name ON rbac.permissions(name);
CREATE INDEX IF NOT EXISTS idx_rbac_permissions_category ON rbac.permissions(category);

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS rbac.roles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rbac_roles_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rbac_roles_tenant_id ON rbac.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rbac_roles_name ON rbac.roles(name);
CREATE INDEX IF NOT EXISTS idx_rbac_roles_is_system ON rbac.roles(is_system);

-- 3. Role-Permissions Join Table
CREATE TABLE IF NOT EXISTS rbac.role_permissions (
    role_id VARCHAR(64) NOT NULL REFERENCES rbac.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES rbac.permissions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_role_id ON rbac.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_perm_id ON rbac.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_tenant_id ON rbac.role_permissions(tenant_id);

-- 4. User-Role Assignments Table
CREATE TABLE IF NOT EXISTS rbac.user_roles (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id VARCHAR(64) NOT NULL,
    role_id VARCHAR(64) NOT NULL REFERENCES rbac.roles(id) ON DELETE CASCADE,
    assigned_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rbac_user_roles UNIQUE (tenant_id, user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_tenant_user ON rbac.user_roles(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_role_id ON rbac.user_roles(role_id);

-- ==========================================================
-- Seed Permissions
-- ==========================================================
INSERT INTO rbac.permissions (id, name, category, description, is_system)
VALUES
    -- RBAC Management
    ('perm_rbac_01', 'rbac:roles:create', 'rbac', 'Create custom roles', TRUE),
    ('perm_rbac_02', 'rbac:roles:read', 'rbac', 'View roles and their permission sets', TRUE),
    ('perm_rbac_03', 'rbac:roles:update', 'rbac', 'Update custom roles and permission mappings', TRUE),
    ('perm_rbac_04', 'rbac:roles:delete', 'rbac', 'Delete custom roles', TRUE),
    ('perm_rbac_05', 'rbac:roles:assign', 'rbac', 'Assign or revoke roles from users', TRUE),
    ('perm_rbac_06', 'rbac:permissions:read', 'rbac', 'List and view platform permissions', TRUE),
    ('perm_rbac_07', 'rbac:permissions:create', 'rbac', 'Register custom platform permissions', TRUE),
    -- IAM
    ('perm_iam_01', 'iam:members:read', 'iam', 'Read organization members', TRUE),
    ('perm_iam_02', 'iam:members:invite', 'iam', 'Invite new members', TRUE),
    ('perm_iam_03', 'iam:members:manage', 'iam', 'Manage organization member status and details', TRUE),
    ('perm_iam_04', 'iam:org:update', 'iam', 'Update organization profile and configuration', TRUE),
    -- Property
    ('perm_prop_01', 'property:create', 'property', 'Create property records', TRUE),
    ('perm_prop_02', 'property:read', 'property', 'View property listings and details', TRUE),
    ('perm_prop_03', 'property:update', 'property', 'Update property details', TRUE),
    ('perm_prop_04', 'property:delete', 'property', 'Archive or delete property records', TRUE),
    ('perm_prop_05', 'property:verify', 'property', 'Verify property compliance and ownership', TRUE),
    -- Caretaking
    ('perm_care_01', 'caretaking:assign', 'caretaking', 'Assign caretaker to property', TRUE),
    ('perm_care_02', 'caretaking:revoke', 'caretaking', 'Revoke caretaker assignment', TRUE),
    ('perm_care_03', 'caretaking:inspect', 'caretaking', 'Perform property inspection', TRUE),
    ('perm_care_04', 'caretaking:threshold:set', 'caretaking', 'Set financial approval thresholds', TRUE),
    -- Maintenance
    ('perm_maint_01', 'maintenance:ticket:create', 'maintenance', 'File maintenance tickets', TRUE),
    ('perm_maint_02', 'maintenance:ticket:update', 'maintenance', 'Update maintenance tickets status', TRUE),
    ('perm_maint_03', 'maintenance:quote:approve', 'maintenance', 'Approve repair quotes', TRUE),
    ('perm_maint_04', 'maintenance:p1:mobilize', 'maintenance', 'Mobilize emergency response team', TRUE),
    -- Finance
    ('perm_fin_01', 'finance:ledger:read', 'finance', 'Read financial ledgers and statements', TRUE),
    ('perm_fin_02', 'finance:expense:submit', 'finance', 'Submit expense claims', TRUE),
    ('perm_fin_03', 'finance:expense:approve', 'finance', 'Approve expenses and invoices', TRUE),
    ('perm_fin_04', 'finance:disburse', 'finance', 'Authorize disbursements and payouts', TRUE),
    -- Rental
    ('perm_rent_01', 'rental:listing:create', 'rental', 'Create rental listings', TRUE),
    ('perm_rent_02', 'rental:listing:publish', 'rental', 'Publish rental listings publicly', TRUE),
    ('perm_rent_03', 'rental:lease:sign', 'rental', 'Sign digital lease agreements', TRUE),
    -- Document
    ('perm_doc_01', 'document:upload', 'document', 'Upload compliance and property documents', TRUE),
    ('perm_doc_02', 'document:read', 'document', 'Read and download stored documents', TRUE),
    ('perm_doc_03', 'document:verify_legal', 'document', 'Perform legal compliance verification', TRUE),
    ('perm_doc_04', 'document:reject', 'document', 'Reject invalid documents', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ==========================================================
-- Seed Default Roles
-- ==========================================================
INSERT INTO rbac.roles (id, tenant_id, name, description, is_system)
VALUES
    ('role_default_super_admin', 'default', 'SUPER_ADMIN', 'Platform super administrator with unrestricted access', TRUE),
    ('role_default_admin', 'default', 'ADMIN', 'Tenant administrator with full operational access', TRUE),
    ('role_default_property_manager', 'default', 'PROPERTY_MANAGER', 'Manages property operations, listings, and maintenance', TRUE),
    ('role_default_finance_controller', 'default', 'FINANCE_CONTROLLER', 'Manages ledger, expense approvals, and financial disbursements', TRUE),
    ('role_default_caretaker', 'default', 'CARETAKER', 'Performs field inspections and initiates maintenance requests', TRUE),
    ('role_default_member', 'default', 'MEMBER', 'Standard organization member with read access and ticket creation', TRUE),
    ('role_default_viewer', 'default', 'VIEWER', 'Read-only viewer across property and document domains', TRUE)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ==========================================================
-- Map Default Permissions to System Roles
-- ==========================================================
-- SUPER_ADMIN & ADMIN get all permissions
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_super_admin', id, 'default' FROM rbac.permissions
ON CONFLICT DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_admin', id, 'default' FROM rbac.permissions
ON CONFLICT DO NOTHING;

-- PROPERTY_MANAGER
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_property_manager', id, 'default' FROM rbac.permissions
WHERE name IN (
    'iam:members:read', 'property:create', 'property:read', 'property:update',
    'caretaking:assign', 'caretaking:revoke', 'caretaking:inspect',
    'maintenance:ticket:create', 'maintenance:ticket:update', 'maintenance:quote:approve',
    'rental:listing:create', 'rental:listing:publish', 'rental:lease:sign',
    'document:upload', 'document:read', 'rbac:roles:read'
)
ON CONFLICT DO NOTHING;

-- FINANCE_CONTROLLER
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_finance_controller', id, 'default' FROM rbac.permissions
WHERE name IN (
    'finance:ledger:read', 'finance:expense:submit', 'finance:expense:approve',
    'finance:disburse', 'maintenance:quote:approve', 'document:read', 'rbac:roles:read'
)
ON CONFLICT DO NOTHING;

-- CARETAKER
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_caretaker', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'caretaking:inspect', 'maintenance:ticket:create',
    'maintenance:ticket:update', 'document:upload', 'document:read'
)
ON CONFLICT DO NOTHING;

-- MEMBER
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_member', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'maintenance:ticket:create', 'document:read'
)
ON CONFLICT DO NOTHING;

-- VIEWER
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_viewer', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'document:read'
)
ON CONFLICT DO NOTHING;

