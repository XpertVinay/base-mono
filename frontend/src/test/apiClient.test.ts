import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '../core/api/client';

describe('ApiClient X-Tenant-ID Header Injection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should inject X-Tenant-ID header when tenantId is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    // Force non-mock mode for this test
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
});
