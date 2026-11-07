-- Migration: 014_caretaking_multitenancy_and_scopes.sql
-- Caretaking Domain: Multi-Tenant Caretaker Profiles, Scoped Assignments & Instant Revocation

-- 1. Ensure caretaking schema exists
CREATE SCHEMA IF NOT EXISTS caretaking;

-- 2. Caretaker Profiles multi-tenancy
CREATE TABLE IF NOT EXISTS caretaking.profiles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64),
    user_id VARCHAR(36) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    experience_years INT NOT NULL DEFAULT 0,
    service_cities JSONB NOT NULL DEFAULT '[]',
    skills JSONB NOT NULL DEFAULT '[]',
    kyc_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    rating_average NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    completed_tasks_count INT NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE caretaking.profiles ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_caretaking_profiles_tenant ON caretaking.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caretaking_profiles_tenant_kyc ON caretaking.profiles(tenant_id, kyc_status);
CREATE INDEX IF NOT EXISTS idx_caretaking_profiles_user ON caretaking.profiles(user_id);

-- 3. Caretaker Assignments multi-tenancy & granular scopes
CREATE TABLE IF NOT EXISTS caretaking.assignments (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64),
    property_id VARCHAR(36) NOT NULL,
    caretaker_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    monthly_fee NUMERIC(12, 2) NOT NULL,
    permission_scopes JSONB NOT NULL DEFAULT '["VIEW_PROPERTY", "INSPECT_PREMISES"]',
    allowed_permissions JSONB NOT NULL DEFAULT '["VIEW_PROPERTY", "INSPECT_PREMISES"]',
    spending_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    spending_threshold_limit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    accepted_at TIMESTAMP WITH TIME ZONE,
    terminated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE caretaking.assignments ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
ALTER TABLE caretaking.assignments ADD COLUMN IF NOT EXISTS permission_scopes JSONB DEFAULT '["VIEW_PROPERTY", "INSPECT_PREMISES"]';
ALTER TABLE caretaking.assignments ADD COLUMN IF NOT EXISTS allowed_permissions JSONB DEFAULT '["VIEW_PROPERTY", "INSPECT_PREMISES"]';
ALTER TABLE caretaking.assignments ADD COLUMN IF NOT EXISTS spending_limit NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE caretaking.assignments ADD COLUMN IF NOT EXISTS spending_threshold_limit NUMERIC(12, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_caretaking_assignments_tenant ON caretaking.assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caretaking_assignments_tenant_status ON caretaking.assignments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_caretaking_assignments_tenant_property ON caretaking.assignments(tenant_id, property_id);
CREATE INDEX IF NOT EXISTS idx_caretaking_assignments_caretaker ON caretaking.assignments(caretaker_id);
CREATE INDEX IF NOT EXISTS idx_caretaking_assignments_owner ON caretaking.assignments(owner_id);
