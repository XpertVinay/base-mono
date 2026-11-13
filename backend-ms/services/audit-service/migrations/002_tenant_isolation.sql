ALTER TABLE audit.audit_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit.audit_logs(tenant_id);
