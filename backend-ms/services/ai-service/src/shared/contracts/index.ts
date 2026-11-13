export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DomainIntegrationEvent<T = unknown> {
  id: string;
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
  version: number;
  tenantId?: string;
}

export type MultiTenancyMode = 'disabled' | 'optional' | 'strict';

export interface MultiTenancyConfig {
  enabled: boolean;
  mode: MultiTenancyMode;
  defaultTenantId: string;
  tenantHeader: string;
  tenantSlugHeader: string;
  subdomainEnabled: boolean;
}

export interface TenantContext {
  tenantId: string;
  tenantSlug?: string;
  source: 'jwt' | 'gateway' | 'header' | 'query' | 'subdomain' | 'default';
  isDefault: boolean;
  verified: boolean;
  multiTenancyEnabled: boolean;
  mode: MultiTenancyMode;
}

export type McpProviderCategory =
  | 'COMMUNICATION'
  | 'SEARCH'
  | 'DATABASE'
  | 'EXTERNAL_API'
  | 'EXTERNAL_MCP'
  | 'CUSTOM';

export type McpTransportType =
  | 'INTERNAL'
  | 'STREAMABLE_HTTP'
  | 'SSE'
  | 'STDIO'
  | 'REST_API'
  | 'POSTGRES_EXTERNAL';

export type McpAuthType =
  | 'NONE'
  | 'BEARER'
  | 'API_KEY'
  | 'BASIC'
  | 'CUSTOM_HEADERS';

export type McpHealthStatus = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface McpProviderDto {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  category: McpProviderCategory;
  transportType: McpTransportType;
  endpointUrl?: string;
  command?: string;
  args: string[];
  authType: McpAuthType;
  hasCredentials: boolean;
  config: Record<string, any>;
  capabilities: Record<string, any>;
  isBuiltin: boolean;
  isEnabled: boolean;
  healthStatus: McpHealthStatus;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpToolDto {
  id: string;
  tenantId: string;
  providerId: string;
  providerSlug: string;
  toolName: string;
  qualifiedName: string;
  description?: string;
  inputSchema: Record<string, any>;
  annotations: Record<string, any>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpContentBlock {
  type: 'text' | 'image' | 'audio' | 'resource' | 'json';
  text?: string;
  data?: any;
  mimeType?: string;
  uri?: string;
}

export interface McpToolCallResultDto {
  providerSlug: string;
  toolName: string;
  qualifiedName: string;
  isError: boolean;
  content: McpContentBlock[];
  structuredContent?: any;
  durationMs: number;
  invocationId: string;
  meta?: Record<string, any>;
}

export interface ToolInvocationDto {
  id: string;
  tenantId: string;
  actorId?: string;
  providerId?: string;
  providerSlug: string;
  toolName: string;
  category: string;
  status: 'SUCCESS' | 'ERROR';
  argumentsRedacted: Record<string, any>;
  resultSummary?: Record<string, any>;
  errorMessage?: string;
  durationMs: number;
  correlationId?: string;
  createdAt: string;
}

export interface SearchResultItemDto {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface NotificationDto {
  id: string;
  recipient: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string;
  createdAt: string;
}

