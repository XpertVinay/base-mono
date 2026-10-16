CREATE SCHEMA IF NOT EXISTS search;

CREATE TABLE IF NOT EXISTS search.search_index (
    id VARCHAR(36) PRIMARY KEY,
    document_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_type ON search.search_index(document_type);
CREATE INDEX IF NOT EXISTS idx_search_title ON search.search_index USING gin(to_tsvector('english', title));
