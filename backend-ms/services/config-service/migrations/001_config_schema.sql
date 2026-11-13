CREATE SCHEMA IF NOT EXISTS app_config;

CREATE TABLE IF NOT EXISTS app_config.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_config.settings (key, value, description)
VALUES
  ('ACTIVE_PAYMENT_GATEWAY', 'STRIPE', 'Active payment processor gateway'),
  ('MULTI_TENANCY_ENABLED', 'true', 'Toggle configurable multi-tenancy across microservices'),
  ('MULTI_TENANCY_MODE', 'optional', 'Multi-tenancy enforcement mode: disabled, optional, strict'),
  ('DEFAULT_TENANT_ID', 'default', 'Fallback tenant identifier when multi-tenancy mode is optional or disabled')
ON CONFLICT (key) DO NOTHING;
