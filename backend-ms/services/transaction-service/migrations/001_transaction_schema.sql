CREATE SCHEMA IF NOT EXISTS transactions;

CREATE TABLE IF NOT EXISTS transactions.transactions (
    id VARCHAR(36) PRIMARY KEY,
    reference_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    failure_reason TEXT,
    provider VARCHAR(50),
    provider_session_id VARCHAR(255),
    provider_transaction_id VARCHAR(255),
    redirect_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions.transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions.transactions(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_txn ON transactions.transactions(provider_transaction_id);
