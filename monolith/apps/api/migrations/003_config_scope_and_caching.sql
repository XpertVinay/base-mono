-- Migration: 003_config_scope_and_caching.sql
-- Adds target/scope field to app_config.settings to distinguish BE, FE, and shared configurations

ALTER TABLE app_config.settings
ADD COLUMN IF NOT EXISTS target VARCHAR(50) NOT NULL DEFAULT 'ALL';

CREATE INDEX IF NOT EXISTS idx_config_target ON app_config.settings(target);
