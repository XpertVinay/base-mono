import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../core/api/client';
import { setStoredAccessToken } from '../core/auth/tokenStorage';

describe('ApiClient X-Tenant-ID and Protected URL Auth Header Injection', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    setStoredAccessToken(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setStoredAccessToken(null);
  });

  it('should inject X-Tenant-ID and explicit token headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    const client = new ApiClient('https://api.example.com');
    await client.request('/test-endpoint', {
      tenantId: 'ten_nexus_logistics_02',
      token: 'test-bearer-token',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledHeaders = mockFetch.mock.calls[0]![1].headers;
    expect(calledHeaders['X-Tenant-ID']).toBe('ten_nexus_logistics_02');
    expect(calledHeaders['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('automatically attaches stored session Bearer token for protected URLs', async () => {
    setStoredAccessToken('session-jwt-123');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch;

    const client = new ApiClient('http://localhost:4000/api/v1');
    await client.get('/orders/ord-1', { tenantId: 'ten_apex_health_01' });

    const calledHeaders = mockFetch.mock.calls[0]![1].headers;
    expect(calledHeaders['Authorization']).toBe('Bearer session-jwt-123');
    expect(calledHeaders['X-Tenant-ID']).toBe('ten_apex_health_01');
  });

  it('does not attach stored session token to public URLs or when skipAuth is true', async () => {
    setStoredAccessToken('session-jwt-123');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    global.fetch = mockFetch;

    const client = new ApiClient('http://localhost:4000/api/v1');
    await client.post('/iam/login', { email: 'a@b.com', password: 'pw' });
    await client.get('/orders/ord-1', { skipAuth: true });

    expect(mockFetch.mock.calls[0]![1].headers['Authorization']).toBeUndefined();
    expect(mockFetch.mock.calls[1]![1].headers['Authorization']).toBeUndefined();
  });
});
