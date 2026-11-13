import { ApiClientOptions, ApiResponse, ApiError } from './types';
import { mockBackend } from './mockBackend';
import {
  isProtectedUrl,
  resolveServiceBaseUrl,
  ServiceBaseUrlOptions,
  ServiceKey,
} from '../config/serviceConfig';
import { getStoredAccessToken } from '../auth/tokenStorage';
import { useApiTrafficStore, detectServiceTag } from './trafficStore';

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
   * Generic request method wrapping native fetch with tenant, device fingerprint,
   * auth headers, and full telemetric traffic inspection towards backend (http://localhost:4000).
   */
  public async request<T = unknown>(endpoint: string, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const method = (options.method || 'GET').toUpperCase() as any;

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

    // Device fingerprinting for OWASP session anti-hijacking
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

    // Correlation & Request Tracing ID
    const correlationId = headers['x-correlation-id'] || `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    headers['x-correlation-id'] = correlationId;
    headers['x-request-id'] = correlationId;

    if (!options.skipAuth && !headers['Authorization'] && !headers['authorization']) {
      const effectiveToken = options.token || (isProtectedUrl(url) ? getStoredAccessToken() : null);
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
    }

    const trafficStore = useApiTrafficStore.getState();
    const connectionMode = trafficStore.connectionMode;
    const isExplicitMock = connectionMode === 'mock' || import.meta.env.VITE_ENABLE_MOCK_API === 'true';

    // 1. Force Mock Mode if requested
    if (isExplicitMock) {
      const mockResult = this.handleMockRoute<T>(endpoint, options, headers);
      if (mockResult) {
        const durationMs = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime));
        trafficStore.addRecord({
          method,
          url,
          endpoint,
          service: detectServiceTag(endpoint),
          status: mockResult.status,
          statusText: mockResult.status === 200 || mockResult.status === 201 ? 'OK (Mock)' : 'Mock Response',
          durationMs,
          headers,
          requestBody: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
          responseBody: mockResult.data,
          mode: 'mock',
        });
        return mockResult;
      }
    }

    // 2. Live Request to Backend (http://localhost:4000 via Vite proxy or direct)
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const durationMs = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime));

      let responseData: any;
      const contentType = response.headers && typeof response.headers.get === 'function'
        ? response.headers.get('content-type') || ''
        : '';

      if (typeof response.json === 'function' && (!contentType || contentType.includes('application/json'))) {
        try {
          responseData = await response.json();
        } catch {
          responseData = typeof response.text === 'function' ? await response.text() : undefined;
        }
      } else if (typeof response.text === 'function') {
        responseData = await response.text();
      } else {
        responseData = response;
      }

      // Record to Traffic Telemetry
      trafficStore.addRecord({
        method,
        url,
        endpoint,
        service: detectServiceTag(endpoint),
        status: response.status,
        statusText: response.statusText || `${response.status}`,
        durationMs,
        headers,
        requestBody: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
        responseBody: responseData,
        mode: 'live',
      });

      if (!response.ok) {
        throw new ApiError(
          `Request failed with status ${response.status}`,
          response.status,
          responseData
        );
      }

      return {
        data: responseData as T,
        status: response.status,
      };
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        throw err;
      }

      const durationMs = Math.max(1, Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime));

      // 3. Fallback: If network connection failed (backend offline) and mode allows fallback (auto or dev)
      if (connectionMode === 'auto' || import.meta.env.DEV) {
        const mockFallback = this.handleMockRoute<T>(endpoint, options, headers);
        if (mockFallback) {
          trafficStore.addRecord({
            method,
            url,
            endpoint,
            service: detectServiceTag(endpoint),
            status: mockFallback.status,
            statusText: `Fallback Simulated (${err instanceof Error ? err.message : 'Network failure'})`,
            durationMs,
            headers,
            requestBody: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
            responseBody: mockFallback.data,
            error: err instanceof Error ? err.message : String(err),
            mode: 'mock',
          });
          return mockFallback;
        }
      }

      const message = err instanceof Error ? err.message : 'Unknown network failure';
      trafficStore.addRecord({
        method,
        url,
        endpoint,
        service: detectServiceTag(endpoint),
        status: 0,
        statusText: 'Network Error / Connection Refused',
        durationMs,
        headers,
        requestBody: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
        error: message,
        mode: 'failed',
      });

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
   * Internal mock router to serve test requests in offline/demo mode,
   * completely aligned with http://localhost:4000/api-docs/ standard envelopes.
   */
  private handleMockRoute<T>(
    endpoint: string,
    options: ApiClientOptions,
    headers: Record<string, string>
  ): ApiResponse<T> | null {
    const tenantSlug = (options.tenantId || headers['X-Tenant-ID'] || 'apex-health')
      .replace('ten_', '')
      .replace(/_[0-9]+/, '');
    const cleanSlug = tenantSlug.includes('health')
      ? 'apex-health'
      : tenantSlug.includes('logistics')
      ? 'nexus-logistics'
      : 'aura-fintech';

    const cleanPath = endpoint.split('?')[0] || '';
    const method = (options.method || 'GET').toUpperCase();

    // Helper to format microservices standard envelope
    const envelope = (data: unknown, message = 'Success', pagination?: unknown) => ({
      status: true,
      message,
      data,
      errors: [],
      meta_data: {
        requestId: headers['x-correlation-id'] || `req-${Date.now()}`,
        timestamp: new Date().toISOString(),
        debug: { service: detectServiceTag(endpoint), env: 'mock-simulation' },
        pagination: pagination || undefined,
      },
    });

    // 1. Health Endpoint
    if (cleanPath.endsWith('/health') || cleanPath.endsWith('/health/detailed')) {
      const data = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        services: {
          gateway: 'UP',
          database: 'UP',
          rabbitmq: 'UP',
          iam: 'UP',
          organizations: 'UP',
          config: 'UP',
          rbac: 'UP',
        },
      };
      return { data: envelope(data, 'System is healthy and operational') as unknown as T, status: 200 };
    }

    // 2. Organizations CRUD (/api/v1/organizations, /organizations)
    if (cleanPath.includes('/organizations')) {
      // GET /organizations/:idOrSlug
      const idMatch = cleanPath.match(/\/organizations\/([^/?#]+)$/);
      if (idMatch && idMatch[1] && method === 'GET') {
        const org = mockBackend.getOrganization(idMatch[1]);
        if (!org) throw new ApiError('Organization not found', 404);
        return { data: envelope(org, 'Organization retrieved successfully') as unknown as T, status: 200 };
      }

      // GET /organizations
      if (method === 'GET') {
        const list = mockBackend.getOrganizations(options.params as any);
        return {
          data: envelope(list, 'Organizations retrieved successfully', {
            page: Number(options.params?.page || 1),
            limit: Number(options.params?.limit || 20),
            total: list.length,
          }) as unknown as T,
          status: 200,
        };
      }

      // POST /organizations
      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const created = mockBackend.createOrganization(body);
        return { data: envelope(created, 'Organization created successfully') as unknown as T, status: 201 };
      }

      // PUT / PATCH /organizations/:id
      if (idMatch && idMatch[1] && (method === 'PUT' || method === 'PATCH')) {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const updated = mockBackend.updateOrganization(idMatch[1], body);
        if (!updated) throw new ApiError('Organization not found', 404);
        return { data: envelope(updated, 'Organization updated successfully') as unknown as T, status: 200 };
      }

      // DELETE /organizations/:id
      if (idMatch && idMatch[1] && method === 'DELETE') {
        const deleted = mockBackend.deleteOrganization(idMatch[1]);
        return { data: envelope({ deleted }, 'Organization deleted successfully') as unknown as T, status: 200 };
      }
    }

    // 3. Dynamic Config CRUD (/api/v1/config, /config)
    if (cleanPath.includes('/config')) {
      const keyMatch = cleanPath.match(/\/config\/([^/?#]+)$/);

      // GET /config/client
      if (cleanPath.endsWith('/config/client') && method === 'GET') {
        const configs = mockBackend.getConfigs();
        const map: Record<string, string> = {};
        configs.forEach((c) => {
          if (c.target === 'FRONTEND' || c.target === 'ALL') map[c.key] = c.value;
        });
        return { data: envelope(map, 'Client configurations retrieved') as unknown as T, status: 200 };
      }

      // GET /config/:key
      if (keyMatch && keyMatch[1] && method === 'GET') {
        const found = mockBackend.getConfig(keyMatch[1]);
        if (!found) throw new ApiError('Configuration key not found', 404);
        return { data: envelope(found, 'Configuration retrieved') as unknown as T, status: 200 };
      }

      // GET /config
      if (method === 'GET') {
        const configs = mockBackend.getConfigs();
        return { data: envelope(configs, 'Configuration list retrieved') as unknown as T, status: 200 };
      }

      // POST /config or PUT /config/:key
      if (method === 'POST' || method === 'PUT') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const key = keyMatch && keyMatch[1] ? keyMatch[1] : body.key;
        const setConfig = mockBackend.setConfig({ ...body, key });
        return { data: envelope(setConfig, 'Configuration set successfully') as unknown as T, status: 200 };
      }

      // DELETE /config/:key
      if (keyMatch && keyMatch[1] && method === 'DELETE') {
        const deleted = mockBackend.deleteConfig(keyMatch[1]);
        return { data: envelope({ deleted, key: keyMatch[1] }, 'Configuration deleted') as unknown as T, status: 200 };
      }
    }

    // 4. RBAC Roles CRUD (/api/v1/rbac/roles, /rbac/roles)
    if (cleanPath.includes('/rbac/roles')) {
      const idMatch = cleanPath.match(/\/rbac\/roles\/([^/?#]+)$/);

      // GET /rbac/roles/:id
      if (idMatch && idMatch[1] && method === 'GET') {
        const role = mockBackend.getRole(idMatch[1]);
        if (!role) throw new ApiError('Role not found', 404);
        return { data: envelope(role, 'Role retrieved') as unknown as T, status: 200 };
      }

      // GET /rbac/roles
      if (method === 'GET') {
        const roles = mockBackend.getRoles(options.params as any);
        return {
          data: envelope(roles, 'Roles retrieved successfully', {
            page: 1,
            limit: 20,
            total: roles.length,
          }) as unknown as T,
          status: 200,
        };
      }

      // POST /rbac/roles
      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const created = mockBackend.createRole(body);
        return { data: envelope(created, 'Role created successfully') as unknown as T, status: 201 };
      }

      // PUT /rbac/roles/:id
      if (idMatch && idMatch[1] && method === 'PUT') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const updated = mockBackend.updateRole(idMatch[1], body);
        if (!updated) throw new ApiError('Role not found', 404);
        return { data: envelope(updated, 'Role updated successfully') as unknown as T, status: 200 };
      }

      // DELETE /rbac/roles/:id
      if (idMatch && idMatch[1] && method === 'DELETE') {
        const deleted = mockBackend.deleteRole(idMatch[1]);
        return { data: envelope({ deleted }, 'Role deleted successfully') as unknown as T, status: 200 };
      }
    }

    // 5. Notifications (/api/v1/notifications, /notifications)
    if (cleanPath.includes('/notifications')) {
      if (cleanPath.endsWith('/dry-run/outbox') && method === 'GET') {
        const all = mockBackend.getNotifications().filter((n) => n.isDryRun);
        return { data: envelope(all, 'Dry-run outbox retrieved') as unknown as T, status: 200 };
      }

      if (method === 'GET') {
        const list = mockBackend.getNotifications();
        return { data: envelope(list, 'Notifications list retrieved') as unknown as T, status: 200 };
      }

      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const isDryRun = Boolean(body.dryRun || headers['x-dry-run'] === 'true');
        const sent = mockBackend.sendNotification({ ...body, dryRun: isDryRun });
        return { data: envelope(sent, isDryRun ? 'Notification simulated in DRY-RUN mode' : 'Notification dispatched') as unknown as T, status: 201 };
      }
    }

    // 6. Data Records CRUD (/records)
    if (cleanPath.includes('/records')) {
      const match = cleanPath.match(/\/records\/([^/?#]+)/);

      // GET /records/:id
      if (match && match[1] && method === 'GET') {
        const record = mockBackend.getRecord(cleanSlug, match[1]);
        if (!record) throw new ApiError('Record not found', 404);
        return {
          data: envelope(record, 'Record retrieved successfully') as unknown as T,
          status: 200,
        };
      }

      // GET /records
      if (method === 'GET') {
        const records = mockBackend.getRecords(cleanSlug);
        return {
          data: envelope(records, 'Records retrieved successfully', {
            total: records.length,
          }) as unknown as T,
          status: 200,
        };
      }

      // POST /records
      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const newRec = mockBackend.createRecord(cleanSlug, body);
        return {
          data: envelope(newRec, 'Record created successfully') as unknown as T,
          status: 201,
        };
      }

      // PUT / PATCH /records/:id
      if (match && match[1] && (method === 'PUT' || method === 'PATCH')) {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const updated = mockBackend.updateRecord(cleanSlug, match[1], body);
        if (!updated) throw new ApiError('Record not found', 404);
        return {
          data: envelope(updated, 'Record updated successfully') as unknown as T,
          status: 200,
        };
      }

      // DELETE /records/:id
      if (match && match[1] && method === 'DELETE') {
        mockBackend.deleteRecord(cleanSlug, match[1]);
        return {
          data: envelope({ success: true }, 'Record deleted successfully') as unknown as T,
          status: 200,
        };
      }
    }

    return null;
  }
}

export const apiClient = new ApiClient();
