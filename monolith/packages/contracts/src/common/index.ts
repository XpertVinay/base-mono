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
}
