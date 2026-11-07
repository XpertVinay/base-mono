-- Migration: 012_shared_services_multitenancy.sql
-- Adds multi-tenant isolation to shared services (notification, scheduler, search)

-- 1. Notification Schema Multi-Tenancy
ALTER TABLE notification.notifications
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created ON notification.notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_status ON notification.notifications(tenant_id, status);

-- 2. Scheduler Schema Multi-Tenancy & Run History
ALTER TABLE scheduler.jobs
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON scheduler.jobs(tenant_id);

CREATE TABLE IF NOT EXISTS scheduler.job_runs (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(64),
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INT,
    failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON scheduler.job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_tenant ON scheduler.job_runs(tenant_id);

-- 3. Search Schema Multi-Tenancy
ALTER TABLE search.search_index
ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_search_tenant ON search.search_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_tenant_type ON search.search_index(tenant_id, document_type);
