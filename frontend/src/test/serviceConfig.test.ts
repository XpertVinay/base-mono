import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SERVICE_CONFIG,
  ServiceKey,
  buildServiceUrl,
  getAllServiceBaseUrls,
  getServiceEndpointEnvKey,
  resolveApiBaseUrl,
  resolveExternalServiceUrl,
  resolveServiceBaseUrl,
  resolveServiceEndpoint,
  isProtectedUrl,
} from '../core/config';
import { ApiClient } from '../core/api/client';

describe('Unified Service Configuration Helper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps service keys to standardized VITE_<SERVICE>_ENDPOINT env keys', () => {
    expect(getServiceEndpointEnvKey('audit')).toBe('VITE_AUDIT_ENDPOINT');
    expect(getServiceEndpointEnvKey('iam')).toBe('VITE_IAM_ENDPOINT');
    expect(getServiceEndpointEnvKey('notifications')).toBe('VITE_NOTIFICATIONS_ENDPOINT');
  });

  it('resolves BaseUrl = ENV.VITE_GATEWAY_URL + ENV.VITE_API_BASE_URL + (ENV.<SERVICE>_ENDPOINT | Config.<SERVICE>_ENDPOINT)', () => {
    const env = {
      VITE_GATEWAY_URL: 'http://localhost:4000',
      VITE_API_BASE_URL: '/api/v1',
      VITE_ORDERS_ENDPOINT: '/orders-v2',
    };

    expect(resolveApiBaseUrl({ env })).toBe('http://localhost:4000/api/v1');
    expect(resolveServiceBaseUrl('orders', { env })).toBe('http://localhost:4000/api/v1/orders-v2');
    expect(resolveServiceBaseUrl('iam', { env })).toBe('http://localhost:4000/api/v1/iam');
    expect(resolveServiceBaseUrl('audit', { env })).toBe('http://localhost:4000/api/v1/audit');
  });

  it('resolves all registered services unifiedly via getAllServiceBaseUrls', () => {
    const env = {
      VITE_GATEWAY_URL: 'http://localhost:4000',
      VITE_API_BASE_URL: '/api/v1',
    };

    const urls = getAllServiceBaseUrls({ env });
    const serviceKeys = Object.keys(SERVICE_CONFIG.ENDPOINTS) as ServiceKey[];

    for (const key of serviceKeys) {
      expect(urls[key]).toBe(`http://localhost:4000/api/v1${SERVICE_CONFIG.ENDPOINTS[key]}`);
    }
  });

  it('builds complete endpoint URLs with buildServiceUrl', () => {
    const env = {
      VITE_GATEWAY_URL: 'https://gw.enterprise.io/',
      VITE_API_BASE_URL: 'api/v1/',
    };

    expect(buildServiceUrl('tenants', '/config', { env })).toBe(
      'https://gw.enterprise.io/api/v1/tenants/config'
    );
    expect(buildServiceUrl('transactions', 'settlements/daily', { env })).toBe(
      'https://gw.enterprise.io/api/v1/transactions/settlements/daily'
    );
  });

  it('falls back to relative paths when VITE_GATEWAY_URL is unset and ignores invalid strings', () => {
    const env = {
      VITE_GATEWAY_URL: 'undefined',
      VITE_API_BASE_URL: '/api/v1',
      VITE_IAM_ENDPOINT: 'null',
    };

    expect(resolveServiceEndpoint('iam', undefined, env)).toBe('/iam');
    expect(resolveServiceBaseUrl('iam', { env })).toBe('/api/v1/iam');
  });

  it('resolves external observability URLs with Config fallbacks', () => {
    expect(resolveExternalServiceUrl('GRAFANA_URL', undefined, {})).toBe(
      SERVICE_CONFIG.EXTERNAL.GRAFANA_URL
    );
    expect(
      resolveExternalServiceUrl('PROMETHEUS_URL', undefined, {
        VITE_PROMETHEUS_URL: 'http://prom.internal:9090/',
      })
    ).toBe('http://prom.internal:9090');
  });

  it('supports service-scoped ApiClient instances via ApiClient.forService', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const ordersClient = ApiClient.forService('orders');
    ordersClient.configure({
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000',
        VITE_API_BASE_URL: '/api/v1',
      },
    });

    expect(ordersClient.getBaseUrl()).toBe('http://localhost:4000/api/v1/orders');

    await ordersClient.get('/ord-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/orders/ord-123',
      expect.any(Object)
    );
  });

  it('classifies public vs protected URLs accurately via isProtectedUrl', () => {
    expect(isProtectedUrl('http://localhost:4000/api/v1/iam/login')).toBe(false);
    expect(isProtectedUrl('/api/v1/iam/register')).toBe(false);
    expect(isProtectedUrl('/api/v1/iam/refresh')).toBe(false);
    expect(isProtectedUrl('/api/v1/iam/oidc/google/callback')).toBe(false);
    expect(isProtectedUrl('/api/v1/tenants/config?identifier=apex')).toBe(false);
    expect(isProtectedUrl('/api/v1/health')).toBe(false);

    expect(isProtectedUrl('http://localhost:4000/api/v1/audit/logs')).toBe(false);
    expect(isProtectedUrl('http://localhost:4000/api/v1/audit/alerts')).toBe(false);
    expect(isProtectedUrl('http://localhost:4000/api/v1/audit/metrics/summary')).toBe(false);

    expect(isProtectedUrl('http://localhost:4000/api/v1/audit/remediate')).toBe(true);
    expect(isProtectedUrl('http://localhost:4000/api/v1/records')).toBe(true);
    expect(isProtectedUrl('/api/v1/iam/profile')).toBe(true);
    expect(isProtectedUrl('/api/v1/iam/tenants')).toBe(true);
    expect(isProtectedUrl('/api/v1/iam/oidc/admin/providers')).toBe(true);
    expect(isProtectedUrl('/api/v1/orders/123')).toBe(true);
  });
});

