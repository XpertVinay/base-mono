export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

export interface ApiErrorPayload {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  status?: number;
}
