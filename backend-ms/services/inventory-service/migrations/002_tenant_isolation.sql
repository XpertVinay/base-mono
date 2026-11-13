ALTER TABLE inventory.inventory_items ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory.inventory_items(tenant_id);
