CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit.audit_logs(tenant_id, created_at DESC);
