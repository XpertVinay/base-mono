CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    actor_id VARCHAR(36),
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    details JSONB,
    ip_address VARCHAR(50),
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit.audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit.audit_logs(severity);
