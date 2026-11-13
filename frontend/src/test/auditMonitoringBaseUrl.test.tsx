import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import {
  AUDIT_CONFIG,
  resolveAuditBaseUrl,
  resolveGrafanaUrl,
  resolvePrometheusUrl
} from '../features/audit-monitoring/config';
import { AuditApiService, auditApi } from '../features/audit-monitoring/services/auditApi';
import { AuditMonitoringApp } from '../features/audit-monitoring/AuditMonitoringApp';
import { setStoredAccessToken } from '../core/auth/tokenStorage';

describe('AuditMonitoring unified BaseUrl resolution', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredAccessToken(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setStoredAccessToken(null);
  });

  it('combines ENV VITE_GATEWAY_URL + VITE_API_BASE_URL + VITE_AUDIT_ENDPOINT', () => {
    const url = resolveAuditBaseUrl({
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000',
        VITE_API_BASE_URL: '/api/v1',
        VITE_AUDIT_ENDPOINT: '/audit-custom'
      }
    });
    expect(url).toBe('http://localhost:4000/api/v1/audit-custom');
  });

  it('falls back to AUDIT_CONFIG.AUDIT_ENDPOINT when ENV endpoint is unset', () => {
    const url = resolveAuditBaseUrl({
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000',
        VITE_API_BASE_URL: '/api/v1'
      }
    });
    expect(url).toBe(`http://localhost:4000/api/v1${AUDIT_CONFIG.AUDIT_ENDPOINT}`);
  });

  it('normalizes extra or missing slashes without producing double slashes', () => {
    const url = resolveAuditBaseUrl({
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000///',
        VITE_API_BASE_URL: 'api/v1/',
        VITE_AUDIT_ENDPOINT: '//audit//'
      }
    });
    expect(url).toBe('http://localhost:4000/api/v1/audit');
  });

  it('returns relative path when VITE_GATEWAY_URL is unset or explicitly empty', () => {
    expect(
      resolveAuditBaseUrl({
        env: {
          VITE_API_BASE_URL: '/api/v1'
        }
      })
    ).toBe('/api/v1/audit');

    expect(
      resolveAuditBaseUrl({
        gatewayUrl: '',
        env: {
          VITE_GATEWAY_URL: 'http://localhost:4000',
          VITE_API_BASE_URL: '/api/v1'
        }
      })
    ).toBe('/api/v1/audit');
  });

  it('does not prepend gatewayUrl when apiBaseUrl is already absolute', () => {
    const url = resolveAuditBaseUrl({
      apiBaseUrl: 'https://api.enterprise.example/api/v1',
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000'
      }
    });
    expect(url).toBe('https://api.enterprise.example/api/v1/audit');
  });

  it('does not duplicate endpoint if apiBaseUrl already ends with it', () => {
    const url = resolveAuditBaseUrl({
      apiBaseUrl: '/api/v1/audit',
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000',
        VITE_API_BASE_URL: '/api/v1'
      }
    });
    expect(url).toBe('http://localhost:4000/api/v1/audit');
  });

  it('resolves Grafana and Prometheus URLs safely without "undefined" string', () => {
    expect(resolveGrafanaUrl(undefined, { VITE_GRAFANA_URL: 'undefined' })).toBe(
      AUDIT_CONFIG.GRAFANA_URL
    );
    expect(resolvePrometheusUrl(undefined, {})).toBe(AUDIT_CONFIG.PROMETHEUS_URL);
    expect(
      resolveGrafanaUrl('http://grafana.internal:3001/', {
        VITE_GRAFANA_URL: 'http://localhost:3000'
      })
    ).toBe('http://grafana.internal:3001');
  });

  it('configures AuditApiService unifiedly and fetches using the resolved baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const service = new AuditApiService({
      env: {
        VITE_GATEWAY_URL: 'http://localhost:4000',
        VITE_API_BASE_URL: '/api/v1'
      }
    });
    expect(service.getBaseUrl()).toBe('http://localhost:4000/api/v1/audit');

    await service.getLogs({ limit: 10 });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/audit/logs?limit=10',
      expect.any(Object)
    );
  });

  it('AuditMonitoringApp updates auditApi baseUrl unifiedly from props + ENV + Config', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          totalEvents: 10,
          errorCount: 0,
          criticalCount: 0,
          riskScore: 5,
          remediationCount: 0,
          systemHealthPct: 99.9
        }
      })
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AuditMonitoringApp
        tenantId="apex-health"
        authToken="jwt-audit-token"
        gatewayUrl="http://localhost:4000"
        apiBaseUrl="/api/v1"
        endpoint="/audit"
      />
    );

    await waitFor(() => {
      expect(auditApi.getBaseUrl()).toBe('http://localhost:4000/api/v1/audit');
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/audit/logs?limit=50',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-audit-token',
            'X-Tenant-ID': 'apex-health'
          })
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/audit/metrics/summary',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-audit-token'
          })
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4000/api/v1/audit/alerts',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-audit-token'
          })
        })
      );
    });
  });
});

