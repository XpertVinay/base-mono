CREATE INDEX IF NOT EXISTS idx_orders_tenant_user_created ON orders.orders(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status_created ON orders.orders(tenant_id, status, created_at DESC);
