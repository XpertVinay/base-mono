ALTER TABLE scheduler.jobs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_scheduler_tenant ON scheduler.jobs(tenant_id);
