ALTER TABLE transactions.transactions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions.transactions(tenant_id);
