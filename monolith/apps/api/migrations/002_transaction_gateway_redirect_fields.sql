-- Migration: 002_transaction_gateway_redirect_fields.sql
-- Adds provider session and redirect URL fields to transaction ledger for hosted gateway flows

ALTER TABLE transactions.transactions
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS provider_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS redirect_url TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions.transactions(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_txn ON transactions.transactions(provider_transaction_id);
