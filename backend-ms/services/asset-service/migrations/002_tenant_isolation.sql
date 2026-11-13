ALTER TABLE asset.assets ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_asset_tenant ON asset.assets(tenant_id);
