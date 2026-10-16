import { ApiErrorPayload } from './apiTypes';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    status: number = 500,
    code: string = 'UNKNOWN_ERROR',
    fieldErrors?: Record<string, string[]>,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.originalError = originalError;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  public static fromResponse(status: number, payload?: unknown): ApiError {
    if (typeof payload === 'object' && payload !== null) {
      const err = payload as ApiErrorPayload;
      return new ApiError(
        err.message || `Request failed with status ${status}`,
        status,
        err.code || `HTTP_${status}`,
        err.fieldErrors
      );
    }
    return new ApiError(`Request failed with status ${status}`, status, `HTTP_${status}`);
  }

  public static networkError(originalError?: unknown): ApiError {
    return new ApiError(
      'Unable to connect to the server. Please check your network connection.',
      0,
      'NETWORK_ERROR',
      undefined,
      originalError
    );
  }

  public static timeoutError(): ApiError {
    return new ApiError('Request timed out. Please try again.', 408, 'REQUEST_TIMEOUT');
  }

  public static unauthorized(): ApiError {
    return new ApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED');
  }
}
