-- Migration: 003_notification_provider_metadata.sql
-- Adds provider, provider_message_id, is_dry_run, metadata, and error_message fields to notification ledger

ALTER TABLE notification.notifications
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_dry_run BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notification.notifications(recipient);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notification.notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_provider ON notification.notifications(provider);
