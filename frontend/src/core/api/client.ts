import { ApiClientOptions, ApiResponse, ApiError } from './types';
import { mockBackend } from './mockBackend';
import {
  isProtectedUrl,
  resolveServiceBaseUrl,
  ServiceBaseUrlOptions,
  ServiceKey,
} from '../config/serviceConfig';
import { getStoredAccessToken } from '../auth/tokenStorage';

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private service?: ServiceKey;

  constructor(
    baseUrl?: string,
    defaultHeaders: HeadersInit = {},
    service?: ServiceKey
  ) {
    this.service = service;
    this.baseUrl = baseUrl
      ? baseUrl.trim().replace(/\/+$/, '')
      : resolveServiceBaseUrl(service);
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...defaultHeaders,
    };
  }

  public static forService(
    service: ServiceKey,
    defaultHeaders: HeadersInit = {}
  ): ApiClient {
    return new ApiClient(undefined, defaultHeaders, service);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  public configure(options: ServiceBaseUrlOptions = {}): string {
    this.baseUrl = resolveServiceBaseUrl(this.service, options);
    return this.baseUrl;
  }

  /**
   * Generic request method wrapping native fetch with tenant and auth headers
   */
  public async request<T = unknown>(endpoint: string, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const isMock = import.meta.env.VITE_ENABLE_MOCK_API === 'true' || import.meta.env.DEV;

    // Check if we should serve from mock backend
    if (isMock) {
      const mockResult = this.handleMockRoute<T>(endpoint, options);
      if (mockResult) {
        return mockResult;
      }
    }

    // Build URL with query params
    let url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (options.params) {
      const query = new URLSearchParams();
      Object.entries(options.params).forEach(([key, val]) => {
        if (val !== undefined) query.append(key, String(val));
      });
      const queryString = query.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    // Construct headers
    const headers: Record<string, string> = {
      ...(this.defaultHeaders as Record<string, string>),
      ...(options.headers as Record<string, string>),
    };

    if (options.tenantId) {
      headers['X-Tenant-ID'] = options.tenantId;
    }

    if (options.tenantSlug) {
      headers['X-Tenant-Slug'] = options.tenantSlug;
    }

    if (typeof window !== 'undefined') {
      try {
        let fgp = localStorage.getItem('app_device_fingerprint');
        if (!fgp) {
          const screenRes = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
          fgp = `web-${screenRes}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('app_device_fingerprint', fgp);
        }
        headers['X-Device-Fingerprint'] = fgp;
      } catch {
        // storage disabled fallback
      }
    }

    if (!options.skipAuth && !headers['Authorization'] && !headers['authorization']) {
      const effectiveToken = options.token || (isProtectedUrl(url) ? getStoredAccessToken() : null);
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        throw new ApiError(
          `Request failed with status ${response.status}`,
          response.status,
          errorBody
        );
      }

      const data = (await response.json()) as T;
      return {
        data,
        status: response.status,
      };
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }

      // If network fails in dev, gracefully fallback to mock
      if (isMock) {
        const mockFallback = this.handleMockRoute<T>(endpoint, options);
        if (mockFallback) return mockFallback;
      }

      const message = err instanceof Error ? err.message : 'Unknown network failure';
      throw new ApiError(`Network error: ${message}`, 0, err);
    }
  }

  public get<T>(endpoint: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: ApiClientOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Internal mock router to serve test requests in offline/demo mode
   */
  private handleMockRoute<T>(endpoint: string, options: ApiClientOptions): ApiResponse<T> | null {
    const tenantSlug = (options.tenantId || 'apex-health').replace('ten_', '').replace(/_[0-9]+/, '');
    const cleanSlug = tenantSlug.includes('health')
      ? 'apex-health'
      : tenantSlug.includes('logistics')
      ? 'nexus-logistics'
      : 'aura-fintech';

    // GET /records
    if (endpoint.includes('/records') && (!options.method || options.method === 'GET')) {
      const records = mockBackend.getRecords(cleanSlug);
      return {
        data: records as unknown as T,
        status: 200,
        meta: { total: records.length, tenantId: options.tenantId },
      };
    }

    // POST /records
    if (endpoint.includes('/records') && options.method === 'POST') {
      const body = options.body ? JSON.parse(options.body as string) : {};
      const newRec = mockBackend.createRecord(cleanSlug, body);
      return {
        data: newRec as unknown as T,
        status: 201,
        meta: { tenantId: options.tenantId },
      };
    }

    // DELETE /records/:id
    if (endpoint.includes('/records/') && options.method === 'DELETE') {
      const recordId = endpoint.split('/').pop() || '';
      mockBackend.deleteRecord(cleanSlug, recordId);
      return {
        data: { success: true } as unknown as T,
        status: 200,
      };
    }

    return null;
  }
}

export const apiClient = new ApiClient();
