-- Migration: 011_transaction_multitenancy_and_idempotency.sql
-- Adds multi-tenant scoping and idempotent webhook event tracking for transactions

-- 1. Multi-Tenant column on transactions ledger
ALTER TABLE transactions.transactions
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);

-- 2. Compound multi-tenant performance indexes
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created ON transactions.transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_reference ON transactions.transactions(tenant_id, reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_user ON transactions.transactions(tenant_id, user_id);

-- 3. Idempotent webhook event ledger to defend against replay attacks and race conditions
CREATE TABLE IF NOT EXISTS transactions.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64),
  provider VARCHAR(32) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant ON transactions.webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON transactions.webhook_events(provider, event_id);

