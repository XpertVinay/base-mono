-- Migration 010: Order Multi-Tenancy and Extended State Lifecycle

ALTER TABLE orders.orders
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default-tenant';

ALTER TABLE orders.order_items
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(36) NOT NULL DEFAULT 'default-tenant';

-- Compound indexes for tenant queries
CREATE INDEX IF NOT EXISTS idx_orders_tenant_user ON orders.orders(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders.orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON orders.order_items(tenant_id);

