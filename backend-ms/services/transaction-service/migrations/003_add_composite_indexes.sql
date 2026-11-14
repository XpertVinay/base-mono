CREATE INDEX IF NOT EXISTS idx_transactions_tenant_user_created ON transactions.transactions(tenant_id, user_id, created_at DESC);
