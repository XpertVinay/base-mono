export interface SearchResultItemDto {
  id: string;
  tenantId?: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface SearchQueryDto {
  tenantId?: string;
  query: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface IndexDocumentRequestDto {
  id: string;
  tenantId?: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
