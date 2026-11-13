-- ==========================================================
-- AI & MCP Integration Service Schema
-- ==========================================================

CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.mcp_providers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    slug VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    transport_type VARCHAR(50) NOT NULL,
    endpoint_url TEXT,
    command VARCHAR(255),
    args JSONB NOT NULL DEFAULT '[]'::jsonb,
    auth_type VARCHAR(50) NOT NULL DEFAULT 'NONE',
    credentials_encrypted TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    health_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_mcp_providers_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ai_mcp_providers_tenant ON ai.mcp_providers(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_providers_category ON ai.mcp_providers(category);

CREATE TABLE IF NOT EXISTS ai.mcp_tools (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    provider_id VARCHAR(36) NOT NULL REFERENCES ai.mcp_providers(id) ON DELETE CASCADE,
    provider_slug VARCHAR(100) NOT NULL,
    tool_name VARCHAR(150) NOT NULL,
    qualified_name VARCHAR(255) NOT NULL,
    description TEXT,
    input_schema JSONB NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
    annotations JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ai_mcp_tools_provider_tool UNIQUE (tenant_id, provider_id, tool_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_mcp_tools_tenant ON ai.mcp_tools(tenant_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_ai_mcp_tools_qualified ON ai.mcp_tools(qualified_name);

CREATE TABLE IF NOT EXISTS ai.tool_invocations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    actor_id VARCHAR(64),
    provider_id VARCHAR(36),
    provider_slug VARCHAR(100) NOT NULL,
    tool_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    status VARCHAR(32) NOT NULL,
    arguments_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
    result_summary JSONB,
    error_message TEXT,
    duration_ms INT NOT NULL DEFAULT 0,
    correlation_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_tenant ON ai.tool_invocations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_invocations_provider ON ai.tool_invocations(provider_slug, tool_name);

