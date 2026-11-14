CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_search_title_trgm ON search.search_index USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_desc_trgm ON search.search_index USING gin (description gin_trgm_ops);
