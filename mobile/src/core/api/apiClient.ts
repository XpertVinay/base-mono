import { RequestOptions, ApiResponse } from './apiTypes';
import { ApiError } from './apiError';
import { SessionManager } from '../auth/sessionManager';
import { tenantRegistry } from '../tenant/tenantRegistry';
import { TenantResolver } from '../tenant/tenantResolver';

export interface ApiClientConfig {
  defaultTimeoutMs?: number;
  useMockFallback?: boolean;
}

export class ApiClient {
  private defaultTimeoutMs: number;
  private useMockFallback: boolean;

  constructor(config?: ApiClientConfig) {
    this.defaultTimeoutMs = config?.defaultTimeoutMs ?? 15000;
    this.useMockFallback = config?.useMockFallback ?? true;
  }

  private async getBaseUrl(): Promise<string> {
    const tenant = await TenantResolver.resolveActiveTenant();
    return tenant.apiBaseUrl || tenantRegistry.getDefault().apiBaseUrl;
  }

  public async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      params,
      body,
      timeoutMs = this.defaultTimeoutMs,
      skipAuth = false,
      ...rest
    } = options;

    const tenant = await TenantResolver.resolveActiveTenant();
    const baseUrl = await this.getBaseUrl();

    // Query parameters
    let url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined) searchParams.append(key, String(val));
      });
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    // Default headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Tenant-ID': tenant.tenantId,
      'X-Tenant-Slug': tenant.tenantSlug,
      ...headers,
    };

    if (!skipAuth) {
      const token = await SessionManager.getAccessToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        ...rest,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const payload = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          throw ApiError.unauthorized();
        }
        throw ApiError.fromResponse(response.status, payload);
      }

      return {
        data: payload as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw ApiError.timeoutError();
      }

      throw ApiError.networkError(err);
    }
  }

  public get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  public delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
