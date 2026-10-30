-- Migration: 004_tenant_configuration_and_pii_encryption.sql
-- Enables database-driven multi-tenant configuration and tenant-scoped relational storage

-- 1. Create relational tenant_configurations table for modular section overrides
CREATE TABLE IF NOT EXISTS app_config.tenant_configurations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    section VARCHAR(50) NOT NULL,
    config_data JSONB NOT NULL,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_section UNIQUE (tenant_id, section)
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_tenant ON app_config.tenant_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_config_section ON app_config.tenant_configurations(section);

-- 2. Add tenant_id to settings table to support tenant-specific individual key overrides
ALTER TABLE app_config.settings
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_config_tenant_id ON app_config.settings(tenant_id);
