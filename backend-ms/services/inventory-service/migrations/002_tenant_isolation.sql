ALTER TABLE inventory.inventory_items ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory.inventory_items(tenant_id);
ALTER TABLE inventory.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_sku_key;
ALTER TABLE inventory.inventory_items DROP CONSTRAINT IF EXISTS uq_inventory_tenant_sku;
ALTER TABLE inventory.inventory_items ADD CONSTRAINT uq_inventory_tenant_sku UNIQUE (tenant_id, sku);
