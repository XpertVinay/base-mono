export interface SearchResultItemDto {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface SearchQueryDto {
  query: string;
  type?: string;
  limit?: number;
  offset?: number;
}
