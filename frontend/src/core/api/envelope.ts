import { ApiError } from './types';

export interface MetaData {
  requestId: string;
  timestamp: string;
  debug?: Record<string, unknown> | null;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  } | null;
  further_steps?: string[] | null;
}

export interface StandardApiEnvelope<T = unknown> {
  status?: boolean;
  success?: boolean;
  message?: string;
  data: T;
  errors?: Array<{ code?: string; message?: string; field?: string } | string>;
  meta_data?: MetaData;
  meta?: MetaData | { requestId?: string; timestamp?: string };
}

export interface MiddlewareErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiResult<T> {
  data: T;
  message: string;
  meta?: MetaData | Record<string, unknown>;
  status: number;
}

export class ApiServiceError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly furtherSteps?: string[];
  public readonly details?: unknown;

  constructor(message: string, status: number, code?: string, furtherSteps?: string[], details?: unknown) {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.code = code;
    this.furtherSteps = furtherSteps;
    this.details = details;
  }
}

export function extractApiServiceError(err: unknown): ApiServiceError {
  if (err instanceof ApiServiceError) {
    return err;
  }

  if (err instanceof ApiError) {
    const details = err.details as Partial<StandardApiEnvelope & MiddlewareErrorPayload> | undefined;

    if (details && typeof details === 'object') {
      // Middleware shape: { success: false, error: { code, message } }
      if ('error' in details && details.error && typeof details.error === 'object') {
        return new ApiServiceError(
          details.error.message || err.message,
          err.status,
          details.error.code,
          undefined,
          details
        );
      }

      // StandardResponse envelope shape: { status: false, message, errors, meta_data }
      if ('message' in details || 'status' in details || 'errors' in details) {
        const firstErr = Array.isArray(details.errors) ? details.errors[0] : undefined;
        const code =
          typeof firstErr === 'object' && firstErr !== null && 'code' in firstErr
            ? String(firstErr.code)
            : undefined;
        return new ApiServiceError(
          String(details.message || err.message),
          err.status,
          code,
          details.meta_data?.further_steps ?? undefined,
          details
        );
      }
    }

    return new ApiServiceError(err.message, err.status, undefined, undefined, err.details);
  }

  return new ApiServiceError(err instanceof Error ? err.message : 'Unexpected API error', 500);
}

export function unwrapEnvelope<T>(raw: unknown, status = 200): ApiResult<T> {
  if (!raw || typeof raw !== 'object') {
    return {
      data: raw as T,
      message: 'Success',
      status,
    };
  }

  const body = raw as Partial<StandardApiEnvelope<T> & MiddlewareErrorPayload>;

  if (body.success === false && body.error) {
    throw new ApiServiceError(body.error.message, status, body.error.code, undefined, raw);
  }

  if (body.status === false) {
    const firstErr = Array.isArray(body.errors) ? body.errors[0] : undefined;
    const code =
      typeof firstErr === 'object' && firstErr !== null && 'code' in firstErr
        ? String(firstErr.code)
        : undefined;
    throw new ApiServiceError(
      body.message || 'Request failed',
      status,
      code,
      body.meta_data?.further_steps ?? undefined,
      raw
    );
  }

  const data = body.data !== undefined ? body.data : (raw as T);
  const meta = body.meta_data || (body.meta as MetaData | undefined);

  return {
    data: data as T,
    message: body.message || 'Success',
    meta,
    status,
  };
}

export interface RequestContextOptions {
  token?: string;
  tenantId?: string;
  tenantSlug?: string;
}

