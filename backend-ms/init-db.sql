-- ==========================================================
-- Microservices PostgreSQL Unified Schema & Seed Script
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. IAM (Multi-Tenant + OIDC Federated Login)
CREATE SCHEMA IF NOT EXISTS iam;

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

INSERT INTO iam.tenants (id, slug, name, is_active)
VALUES ('default', 'default', 'Default Tenant', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS iam.users (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    auth_method VARCHAR(32) NOT NULL DEFAULT 'LOCAL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_iam_users_tenant_email ON iam.users(tenant_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_iam_users_email ON iam.users(email);
CREATE INDEX IF NOT EXISTS idx_iam_users_tenant_id ON iam.users(tenant_id);

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

-- 2. Asset
CREATE SCHEMA IF NOT EXISTS asset;
CREATE TABLE IF NOT EXISTS asset.assets (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_asset_tenant ON asset.assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_owner ON asset.assets(owner_id);

-- 3. App Config
CREATE SCHEMA IF NOT EXISTS app_config;
CREATE TABLE IF NOT EXISTS app_config.settings (
    key VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_app_config_tenant ON app_config.settings(tenant_id);
INSERT INTO app_config.settings (key, tenant_id, value, description)
VALUES
  ('ACTIVE_PAYMENT_GATEWAY', 'default', 'STRIPE', 'Active payment processor gateway'),
  ('MULTI_TENANCY_ENABLED', 'default', 'true', 'Toggle configurable multi-tenancy across microservices'),
  ('MULTI_TENANCY_MODE', 'default', 'optional', 'Multi-tenancy enforcement mode: disabled, optional, strict'),
  ('DEFAULT_TENANT_ID', 'default', 'default', 'Fallback tenant identifier when multi-tenancy mode is optional or disabled')
ON CONFLICT (tenant_id, key) DO NOTHING;

-- 4. Notification
CREATE SCHEMA IF NOT EXISTS notification;
CREATE TABLE IF NOT EXISTS notification.notifications (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_tenant ON notification.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification.notifications(status);

-- 5. Scheduler
CREATE SCHEMA IF NOT EXISTS scheduler;
CREATE TABLE IF NOT EXISTS scheduler.jobs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduler_tenant ON scheduler.jobs(tenant_id);
INSERT INTO scheduler.jobs (id, tenant_id, name, cron_expression, status)
VALUES ('job-heartbeat-1', 'default', 'SYSTEM_HEARTBEAT', '*/5 * * * *', 'SCHEDULED')
ON CONFLICT (id) DO NOTHING;

-- 6. Orders
CREATE SCHEMA IF NOT EXISTS orders;
CREATE TABLE IF NOT EXISTS orders.orders (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    total_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders.orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_user_created ON orders.orders(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created ON orders.orders(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS orders.order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON orders.order_items(order_id);

-- 7. Transactions
CREATE SCHEMA IF NOT EXISTS transactions;
CREATE TABLE IF NOT EXISTS transactions.transactions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default' REFERENCES iam.tenants(id) ON DELETE CASCADE,
    reference_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    failure_reason TEXT,
    provider VARCHAR(50),
    provider_session_id VARCHAR(255),
    provider_transaction_id VARCHAR(255),
    redirect_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions.transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions.transactions(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_txn ON transactions.transactions(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_user_created ON transactions.transactions(tenant_id, user_id, created_at DESC);

-- 8. Search
CREATE SCHEMA IF NOT EXISTS search;
CREATE TABLE IF NOT EXISTS search.search_index (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_type ON search.search_index(document_type);
CREATE INDEX IF NOT EXISTS idx_search_tenant ON search.search_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_title_trgm ON search.search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_desc_trgm ON search.search_index USING gin (description gin_trgm_ops);

-- 9. Inventory
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE TABLE IF NOT EXISTS inventory.inventory_items (
    product_id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    sku VARCHAR(100) NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    total_quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_tenant_sku UNIQUE (tenant_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory.inventory_items(tenant_id);
INSERT INTO inventory.inventory_items (product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity)
VALUES 
  ('prod-1', 'default', 'PROD-SKU-001', 100, 0, 100),
  ('prod-2', 'default', 'PROD-SKU-002', 50, 0, 50)
ON CONFLICT (product_id) DO NOTHING;

-- 10. Audit
CREATE SCHEMA IF NOT EXISTS audit;
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    actor_id VARCHAR(36),
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    details JSONB,
    ip_address VARCHAR(50),
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit.audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit.audit_logs(tenant_id, created_at DESC);

-- 11. AI & MCP Integration
CREATE SCHEMA IF NOT EXISTS ai;
CREATE TABLE IF NOT EXISTS ai.mcp_providers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    transport_type VARCHAR(50) NOT NULL,
    endpoint_url TEXT,
    command VARCHAR(255),
    args JSONB NOT NULL DEFAULT '[]'::jsonb,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'NONE',
    credentials_encrypted TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    health_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_mcp_providers_tenant_slug UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_providers_tenant ON ai.mcp_providers(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_providers_category ON ai.mcp_providers(category);

CREATE TABLE IF NOT EXISTS ai.mcp_tools (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    provider_id VARCHAR(36) NOT NULL REFERENCES ai.mcp_providers(id) ON DELETE CASCADE,
    provider_slug VARCHAR(100) NOT NULL,
    tool_name VARCHAR(150) NOT NULL,
    qualified_name VARCHAR(255) NOT NULL,
    description TEXT,
    input_schema JSONB NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
    annotations JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_mcp_tools_provider_tool UNIQUE (tenant_id, provider_id, tool_name)
);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_tools_tenant ON ai.mcp_tools(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_tools_qualified ON ai.mcp_tools(qualified_name);

CREATE TABLE IF NOT EXISTS ai.tool_invocations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    actor_id VARCHAR(64),
    provider_id VARCHAR(36),
    provider_slug VARCHAR(100) NOT NULL,
    tool_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(32) NOT NULL,
    arguments_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary JSONB,
    error_message TEXT,
    duration_ms INT NOT NULL DEFAULT 0,
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_tenant ON ai.tool_invocations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_provider ON ai.tool_invocations(provider_slug, tool_name);


-- 12. Organizations & Tenants Management
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


-- 13. Roles & Permissions (RBAC) Management Service
CREATE SCHEMA IF NOT EXISTS rbac;

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

-- Seed Permissions
INSERT INTO rbac.permissions (id, name, category, description, is_system)
VALUES
    ('perm_rbac_01', 'rbac:roles:create', 'rbac', 'Create custom roles', TRUE),
    ('perm_rbac_02', 'rbac:roles:read', 'rbac', 'View roles and their permission sets', TRUE),
    ('perm_rbac_03', 'rbac:roles:update', 'rbac', 'Update custom roles and permission mappings', TRUE),
    ('perm_rbac_04', 'rbac:roles:delete', 'rbac', 'Delete custom roles', TRUE),
    ('perm_rbac_05', 'rbac:roles:assign', 'rbac', 'Assign or revoke roles from users', TRUE),
    ('perm_rbac_06', 'rbac:permissions:read', 'rbac', 'List and view platform permissions', TRUE),
    ('perm_rbac_07', 'rbac:permissions:create', 'rbac', 'Register custom platform permissions', TRUE),
    ('perm_iam_01', 'iam:members:read', 'iam', 'Read organization members', TRUE),
    ('perm_iam_02', 'iam:members:invite', 'iam', 'Invite new members', TRUE),
    ('perm_iam_03', 'iam:members:manage', 'iam', 'Manage organization member status and details', TRUE),
    ('perm_iam_04', 'iam:org:update', 'iam', 'Update organization profile and configuration', TRUE),
    ('perm_prop_01', 'property:create', 'property', 'Create property records', TRUE),
    ('perm_prop_02', 'property:read', 'property', 'View property listings and details', TRUE),
    ('perm_prop_03', 'property:update', 'property', 'Update property details', TRUE),
    ('perm_prop_04', 'property:delete', 'property', 'Archive or delete property records', TRUE),
    ('perm_prop_05', 'property:verify', 'property', 'Verify property compliance and ownership', TRUE),
    ('perm_care_01', 'caretaking:assign', 'caretaking', 'Assign caretaker to property', TRUE),
    ('perm_care_02', 'caretaking:revoke', 'caretaking', 'Revoke caretaker assignment', TRUE),
    ('perm_care_03', 'caretaking:inspect', 'caretaking', 'Perform property inspection', TRUE),
    ('perm_care_04', 'caretaking:threshold:set', 'caretaking', 'Set financial approval thresholds', TRUE),
    ('perm_maint_01', 'maintenance:ticket:create', 'maintenance', 'File maintenance tickets', TRUE),
    ('perm_maint_02', 'maintenance:ticket:update', 'maintenance', 'Update maintenance tickets status', TRUE),
    ('perm_maint_03', 'maintenance:quote:approve', 'maintenance', 'Approve repair quotes', TRUE),
    ('perm_maint_04', 'maintenance:p1:mobilize', 'maintenance', 'Mobilize emergency response team', TRUE),
    ('perm_fin_01', 'finance:ledger:read', 'finance', 'Read financial ledgers and statements', TRUE),
    ('perm_fin_02', 'finance:expense:submit', 'finance', 'Submit expense claims', TRUE),
    ('perm_fin_03', 'finance:expense:approve', 'finance', 'Approve expenses and invoices', TRUE),
    ('perm_fin_04', 'finance:disburse', 'finance', 'Authorize disbursements and payouts', TRUE),
    ('perm_rent_01', 'rental:listing:create', 'rental', 'Create rental listings', TRUE),
    ('perm_rent_02', 'rental:listing:publish', 'rental', 'Publish rental listings publicly', TRUE),
    ('perm_rent_03', 'rental:lease:sign', 'rental', 'Sign digital lease agreements', TRUE),
    ('perm_doc_01', 'document:upload', 'document', 'Upload compliance and property documents', TRUE),
    ('perm_doc_02', 'document:read', 'document', 'Read and download stored documents', TRUE),
    ('perm_doc_03', 'document:verify_legal', 'document', 'Perform legal compliance verification', TRUE),
    ('perm_doc_04', 'document:reject', 'document', 'Reject invalid documents', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Seed Default Roles
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

-- Seed Default Role-Permission Mappings
INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_super_admin', id, 'default' FROM rbac.permissions
ON CONFLICT DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_admin', id, 'default' FROM rbac.permissions
ON CONFLICT DO NOTHING;

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

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_finance_controller', id, 'default' FROM rbac.permissions
WHERE name IN (
    'finance:ledger:read', 'finance:expense:submit', 'finance:expense:approve',
    'finance:disburse', 'maintenance:quote:approve', 'document:read', 'rbac:roles:read'
)
ON CONFLICT DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_caretaker', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'caretaking:inspect', 'maintenance:ticket:create',
    'maintenance:ticket:update', 'document:upload', 'document:read'
)
ON CONFLICT DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_member', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'maintenance:ticket:create', 'document:read'
)
ON CONFLICT DO NOTHING;

INSERT INTO rbac.role_permissions (role_id, permission_id, tenant_id)
SELECT 'role_default_viewer', id, 'default' FROM rbac.permissions
WHERE name IN (
    'property:read', 'document:read'
)
ON CONFLICT DO NOTHING;
