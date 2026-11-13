ALTER TABLE app_config.settings ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
ALTER TABLE app_config.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE app_config.settings ADD PRIMARY KEY (tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_app_config_tenant ON app_config.settings(tenant_id);
