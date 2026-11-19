import { ApiClientOptions, ApiResponse, ApiError } from './types';
import { mockBackend } from './mockBackend';
import {
  isProtectedUrl,
  resolveServiceBaseUrl,
  ServiceBaseUrlOptions,
  ServiceKey,
} from '../config/serviceConfig';
import { getStoredAccessToken } from '../auth/tokenStorage';
import { useApiTrafficStore, detectServiceTag, HttpMethod } from './trafficStore';

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
    const method = (options.method || 'GET').toUpperCase() as HttpMethod;

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

      let responseData: unknown;
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
        const list = mockBackend.getOrganizations(
          options.params as { search?: string; status?: string; tier?: string }
        );
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

      // GET /config/sections
      if (cleanPath.endsWith('/config/sections') && method === 'GET') {
        const summary = mockBackend.getSectionsSummary();
        return { data: envelope(summary, 'Configuration sections summary retrieved') as unknown as T, status: 200 };
      }

      // GET /config/sections/:section
      const sectionMatch = cleanPath.match(/\/config\/sections\/([^/?#]+)$/);
      if (sectionMatch && sectionMatch[1]) {
        if (method === 'GET') {
          const sec = mockBackend.getSection(sectionMatch[1]);
          return { data: envelope(sec, `Section config for ${sectionMatch[1]} retrieved`) as unknown as T, status: 200 };
        }
        if (method === 'PUT' || method === 'POST') {
          const body = options.body ? JSON.parse(options.body as string) : {};
          const updated = mockBackend.updateSection(sectionMatch[1], body);
          return { data: envelope(updated, `Section config for ${sectionMatch[1]} updated`) as unknown as T, status: 200 };
        }
      }

      // GET /config/cache/stats
      if (cleanPath.endsWith('/config/cache/stats') && method === 'GET') {
        const stats = mockBackend.getCacheStats();
        return { data: envelope(stats, 'Cache telemetry statistics retrieved') as unknown as T, status: 200 };
      }

      // POST /config/cache/invalidate
      if (cleanPath.endsWith('/config/cache/invalidate') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.invalidateCache(body);
        return { data: envelope(res, 'Cache invalidated successfully') as unknown as T, status: 200 };
      }

      // POST /config/context/token
      if (cleanPath.endsWith('/config/context/token') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.createContextToken(body);
        return { data: envelope(res, 'Encrypted tenant context token created') as unknown as T, status: 200 };
      }

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
        const roles = mockBackend.getRoles(options.params as { search?: string; isSystem?: boolean });
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
      if (cleanPath.endsWith('/dry-run/outbox')) {
        if (method === 'GET') {
          const all = mockBackend.getNotifications().filter((n) => n.isDryRun);
          return { data: envelope(all, 'Dry-run outbox retrieved') as unknown as T, status: 200 };
        }
        if (method === 'DELETE') {
          const res = mockBackend.clearDryRunOutbox();
          return { data: envelope(res, 'Dry-run outbox cleared') as unknown as T, status: 200 };
        }
      }

      if (cleanPath.endsWith('/config') && method === 'GET') {
        const cfg = mockBackend.getNotificationConfig();
        return { data: envelope(cfg, 'Notification configuration retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/batch') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.sendBatchNotifications(body.notifications || [], body.dryRun);
        return { data: envelope(res, 'Batch notifications processed') as unknown as T, status: 201 };
      }

      const webhookMatch = cleanPath.match(/\/webhooks\/([^/?#]+)$/);
      if (webhookMatch && webhookMatch[1] && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.simulateWebhook(webhookMatch[1], body);
        return { data: envelope(res, 'Webhook ingested successfully') as unknown as T, status: 200 };
      }

      const idMatch = cleanPath.match(/\/notifications\/([^/?#]+)$/);
      if (idMatch && idMatch[1] && method === 'GET' && !idMatch[1].includes('config') && !idMatch[1].includes('outbox')) {
        const found = mockBackend.getNotifications().find((n) => n.id === idMatch[1]);
        if (!found) throw new ApiError('Notification not found', 404);
        return { data: envelope(found, 'Notification detail retrieved') as unknown as T, status: 200 };
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

    // 6. Orders CRUD (/api/v1/orders, /orders)
    if (cleanPath.includes('/orders')) {
      const idMatch = cleanPath.match(/\/orders\/([^/?#]+)$/);
      const cancelMatch = cleanPath.match(/\/orders\/([^/?#]+)\/cancel$/);

      if (cancelMatch && cancelMatch[1] && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const cancelled = mockBackend.cancelOrder(cancelMatch[1], body.reason);
        if (!cancelled) throw new ApiError('Order not found', 404);
        return { data: envelope(cancelled, 'Order cancelled successfully') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/my') && method === 'GET') {
        const orders = mockBackend.getOrders();
        return { data: envelope(orders, 'User orders retrieved') as unknown as T, status: 200 };
      }

      if (idMatch && idMatch[1] && method === 'GET' && !idMatch[1].includes('my')) {
        const order = mockBackend.getOrder(idMatch[1]);
        if (!order) throw new ApiError('Order not found', 404);
        return { data: envelope(order, 'Order retrieved successfully') as unknown as T, status: 200 };
      }

      if (method === 'GET') {
        const statusParam = (options.params?.status as string) || undefined;
        const orders = mockBackend.getOrders(statusParam);
        return { data: envelope(orders, 'Orders list retrieved') as unknown as T, status: 200 };
      }

      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const created = mockBackend.createOrder(body);
        return { data: envelope(created, 'Order created successfully') as unknown as T, status: 201 };
      }
    }

    // 7. Inventory CRUD (/api/v1/inventory, /inventory)
    if (cleanPath.includes('/inventory')) {
      if (cleanPath.endsWith('/reserve') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.reserveStock(body);
        return { data: envelope(res, 'Stock reserved successfully') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/release') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.releaseStock(body);
        return { data: envelope(res, 'Stock released successfully') as unknown as T, status: 200 };
      }

      if ((cleanPath.endsWith('/stock') || cleanPath.endsWith('/items')) && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.addStock(body);
        return { data: envelope(res, 'Stock added successfully') as unknown as T, status: 200 };
      }

      const prodMatch = cleanPath.match(/\/inventory\/(?:items\/)?([^/?#]+)$/);
      if (prodMatch && prodMatch[1] && method === 'GET' && prodMatch[1] !== 'items') {
        const item = mockBackend.getStock(prodMatch[1]);
        if (!item) throw new ApiError('Inventory item not found', 404);
        return { data: envelope(item, 'Inventory stock retrieved') as unknown as T, status: 200 };
      }

      if (method === 'GET') {
        const searchParam = (options.params?.search || options.params?.sku) as string | undefined;
        const list = mockBackend.getInventory(searchParam);
        return { data: envelope(list, 'Inventory list retrieved') as unknown as T, status: 200 };
      }
    }

    // 8. Assets CRUD (/api/v1/assets, /assets)
    if (cleanPath.includes('/assets')) {
      const idMatch = cleanPath.match(/\/assets\/([^/?#]+)$/);

      if (idMatch && idMatch[1] && method === 'GET' && !idMatch[1].includes('my')) {
        const asset = mockBackend.getAsset(idMatch[1]);
        if (!asset) throw new ApiError('Asset not found', 404);
        return { data: envelope(asset, 'Asset retrieved successfully') as unknown as T, status: 200 };
      }

      if (idMatch && idMatch[1] && method === 'DELETE') {
        const deleted = mockBackend.deleteAsset(idMatch[1]);
        return { data: envelope({ deleted }, 'Asset deleted successfully') as unknown as T, status: 200 };
      }

      if (method === 'GET') {
        const mime = options.params?.mimeType as string | undefined;
        const list = mockBackend.getAssets(mime);
        return { data: envelope(list, 'Assets retrieved successfully') as unknown as T, status: 200 };
      }

      if (method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const created = mockBackend.createAsset(body);
        return { data: envelope(created, 'Asset metadata registered') as unknown as T, status: 201 };
      }
    }

    // 9. Transactions CRUD (/api/v1/transactions, /transactions)
    if (cleanPath.includes('/transactions')) {
      if (cleanPath.endsWith('/gateways') && method === 'GET') {
        return {
          data: envelope({ gateways: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'], defaultGateway: 'STRIPE' }, 'Gateways retrieved') as unknown as T,
          status: 200,
        };
      }

      if (cleanPath.endsWith('/initiate') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.initiatePayment(body);
        return { data: envelope(res, 'Payment initiated successfully') as unknown as T, status: 200 };
      }

      const refundMatch = cleanPath.match(/\/transactions\/([^/?#]+)\/refund$/);
      if (refundMatch && refundMatch[1] && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.refundPayment(refundMatch[1], body);
        return { data: envelope(res, 'Transaction refunded') as unknown as T, status: 200 };
      }

      const idMatch = cleanPath.match(/\/transactions\/([^/?#]+)$/);
      if (idMatch && idMatch[1] && method === 'GET' && !idMatch[1].includes('tenant') && !idMatch[1].includes('my')) {
        const txn = mockBackend.getTransaction(idMatch[1]);
        if (!txn) throw new ApiError('Transaction not found', 404);
        return { data: envelope(txn, 'Transaction retrieved successfully') as unknown as T, status: 200 };
      }

      if (method === 'GET') {
        const list = mockBackend.getTransactions(
          options.params as { gateway?: string; status?: string }
        );
        return { data: envelope(list, 'Transactions list retrieved') as unknown as T, status: 200 };
      }
    }

    // 10. Scheduler CRUD (/api/v1/scheduler, /scheduler)
    if (cleanPath.includes('/scheduler')) {
      const triggerMatch = cleanPath.match(/\/scheduler\/jobs\/([^/?#]+)\/trigger$/);
      if (triggerMatch && triggerMatch[1] && method === 'POST') {
        const res = mockBackend.triggerJob(triggerMatch[1]);
        return { data: envelope(res, 'Cron job triggered successfully') as unknown as T, status: 200 };
      }

      const idMatch = cleanPath.match(/\/scheduler\/jobs\/([^/?#]+)$/);
      if (idMatch && idMatch[1] && method === 'DELETE') {
        const deleted = mockBackend.deleteJob(idMatch[1]);
        return { data: envelope({ deleted }, 'Scheduled job deleted') as unknown as T, status: 200 };
      }

      if (cleanPath.includes('/jobs') && method === 'GET') {
        const list = mockBackend.getJobs();
        return { data: envelope(list, 'Scheduled cron jobs retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.includes('/jobs') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const created = mockBackend.createJob(body);
        return { data: envelope(created, 'Scheduled job created successfully') as unknown as T, status: 201 };
      }
    }

    // 11. IAM MFA & Cryptography (/api/v1/iam, /iam)
    if (cleanPath.includes('/iam')) {
      if (cleanPath.endsWith('/mfa/status') && method === 'GET') {
        const res = mockBackend.getMfaStatus();
        return { data: envelope(res, 'MFA status retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/mfa/setup') && method === 'POST') {
        const res = mockBackend.setupMfa();
        return { data: envelope(res, 'MFA setup initialized') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/mfa/enable') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.enableMfa(body.code, body.secret);
        return { data: envelope(res, 'MFA enabled successfully') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/mfa/verify') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.verifyMfa(body.mfaChallengeToken, body.code);
        return { data: envelope(res, 'MFA challenge verified') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/mfa/reverify') && method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {};
        const res = mockBackend.reverifyMfa(body.code);
        return { data: envelope(res, 'MFA session reverified') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/.well-known/jwks.json') && method === 'GET') {
        const res = mockBackend.getJwks();
        return { data: envelope(res, 'JWKS key set retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/public-key') && method === 'GET') {
        const res = mockBackend.getPublicKey();
        return { data: envelope(res, 'SPKI RSA Public Key retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/me') && method === 'GET') {
        const res = mockBackend.getMe();
        return { data: envelope(res, 'User profile retrieved') as unknown as T, status: 200 };
      }

      if (cleanPath.endsWith('/audit-logs') && method === 'GET') {
        const res = mockBackend.getAuditLogs();
        return { data: envelope(res, 'Audit logs retrieved') as unknown as T, status: 200 };
      }
    }

    // 12. Data Records CRUD (/records)
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
