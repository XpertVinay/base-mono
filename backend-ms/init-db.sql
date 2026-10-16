-- ==========================================================
-- Microservices PostgreSQL Unified Schema & Seed Script
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. IAM
CREATE SCHEMA IF NOT EXISTS iam;
CREATE TABLE IF NOT EXISTS iam.users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iam_users_email ON iam.users(email);

-- 2. Asset
CREATE SCHEMA IF NOT EXISTS asset;
CREATE TABLE IF NOT EXISTS asset.assets (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_asset_owner ON asset.assets(owner_id);

-- 3. App Config
CREATE SCHEMA IF NOT EXISTS app_config;
CREATE TABLE IF NOT EXISTS app_config.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO app_config.settings (key, value, description)
VALUES ('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', 'Active payment processor gateway')
ON CONFLICT (key) DO NOTHING;

-- 4. Notification
CREATE SCHEMA IF NOT EXISTS notification;
CREATE TABLE IF NOT EXISTS notification.notifications (
    id VARCHAR(36) PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_status ON notification.notifications(status);

-- 5. Scheduler
CREATE SCHEMA IF NOT EXISTS scheduler;
CREATE TABLE IF NOT EXISTS scheduler.jobs (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO scheduler.jobs (id, name, cron_expression, status)
VALUES ('job-heartbeat-1', 'SYSTEM_HEARTBEAT', '*/5 * * * *', 'SCHEDULED')
ON CONFLICT (id) DO NOTHING;

-- 6. Orders
CREATE SCHEMA IF NOT EXISTS orders;
CREATE TABLE IF NOT EXISTS orders.orders (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    total_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders.orders(status);

CREATE TABLE IF NOT EXISTS orders.order_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON orders.order_items(order_id);

-- 7. Transactions
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

-- 8. Search
CREATE SCHEMA IF NOT EXISTS search;
CREATE TABLE IF NOT EXISTS search.search_index (
    id VARCHAR(36) PRIMARY KEY,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_type ON search.search_index(document_type);

-- 9. Inventory
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE TABLE IF NOT EXISTS inventory.inventory_items (
    product_id VARCHAR(36) PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,
    available_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    total_quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO inventory.inventory_items (product_id, sku, available_quantity, reserved_quantity, total_quantity)
VALUES 
  ('prod-1', 'PROD-SKU-001', 100, 0, 100),
  ('prod-2', 'PROD-SKU-002', 50, 0, 50)
ON CONFLICT (product_id) DO NOTHING;
