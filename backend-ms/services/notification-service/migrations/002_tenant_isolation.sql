ALTER TABLE notification.notifications ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_notification_tenant ON notification.notifications(tenant_id);
