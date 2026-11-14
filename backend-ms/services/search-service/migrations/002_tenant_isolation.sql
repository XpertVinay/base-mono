ALTER TABLE search.search_index ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_search_tenant ON search.search_index(tenant_id);
