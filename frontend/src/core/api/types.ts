export interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    tenantId?: string;
  };
  error?: string;
  status: number;
}

export interface ApiClientOptions extends RequestInit {
  tenantId?: string;
  tenantSlug?: string;
  token?: string;
  skipAuth?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}
