-- Migration 008: Asset Lifecycle & Multi-Tenancy
-- Bounded Context: Asset Management (Sprint 05)

-- Add multi-tenancy, categorization, lifecycle status, and checksum columns
ALTER TABLE asset.assets ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default-tenant';
ALTER TABLE asset.assets ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE asset.assets ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING_UPLOAD';
ALTER TABLE asset.assets ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

-- Indexes for performant tenant isolation and owner lookups
CREATE INDEX IF NOT EXISTS idx_asset_tenant_status ON asset.assets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_asset_owner ON asset.assets(owner_id);

