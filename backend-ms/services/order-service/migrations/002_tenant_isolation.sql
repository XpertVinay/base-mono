ALTER TABLE orders.orders ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders.orders(tenant_id);
