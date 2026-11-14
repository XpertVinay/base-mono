import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigGrpcClient } from '../src/grpc/config-grpc.client.js';

class MockConfigServiceRpc {
  public callCount = 0;
  public lastMetadata: any = null;
  public nextError: any = null;
  public nextResponse: any = null;

  GetActivePaymentGateway(_req: any, metadata: any, _options: any, callback: any) {
    this.callCount++;
    this.lastMetadata = metadata;
    if (this.nextError) {
      return callback(this.nextError, null);
    }
    const tenantId = metadata?.get('x-tenant-id')?.[0]?.toString() || 'default';
    const resp = this.nextResponse || {
      provider: tenantId === 'tenant-paypal' ? 'PAYPAL' : 'STRIPE'
    };
    callback(null, resp);
  }

  GetConfigByKey(req: any, metadata: any, _options: any, callback: any) {
    this.callCount++;
    this.lastMetadata = metadata;
    if (this.nextError) {
      return callback(this.nextError, null);
    }
    callback(null, {
      status: true,
      data: { key: req.key, value: 'mock-val' }
    });
  }
}

test('ConfigGrpcClient: Caching, Resilience, and Metadata Propagation', async (t) => {
  await t.test('Client-side caching: multiple calls invoke RPC only once', async () => {
    const mockRpc = new MockConfigServiceRpc();
    const client = new ConfigGrpcClient('dummy:50053', mockRpc, { ttlMs: 10000 });

    const gw1 = await client.getActiveGateway('tenant-1');
    const gw2 = await client.getActiveGateway('tenant-1');
    const gw3 = await client.getActiveGateway('tenant-1');

    assert.equal(gw1, 'STRIPE');
    assert.equal(gw2, 'STRIPE');
    assert.equal(gw3, 'STRIPE');
    assert.equal(mockRpc.callCount, 1);

    const stats = client.getCacheStats();
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
  });

  await t.test('Metadata propagation: attaches x-tenant-id to gRPC call', async () => {
    const mockRpc = new MockConfigServiceRpc();
    const client = new ConfigGrpcClient('dummy:50053', mockRpc);

    await client.getActiveGateway('tenant-custom');
    assert.equal(mockRpc.callCount, 1);
    const tenantHeader = mockRpc.lastMetadata?.get('x-tenant-id')?.[0]?.toString();
    assert.equal(tenantHeader, 'tenant-custom');
  });

  await t.test('Resilient fallback to last-known-good on gRPC failure', async () => {
    const mockRpc = new MockConfigServiceRpc();
    const client = new ConfigGrpcClient('dummy:50053', mockRpc, { ttlMs: 50 });

    // Step 1: Successful resolution of PAYPAL for tenant-paypal
    const gw1 = await client.getActiveGateway('tenant-paypal');
    assert.equal(gw1, 'PAYPAL');
    assert.equal(mockRpc.callCount, 1);

    // Step 2: Invalidate the cache to simulate expiration
    client.invalidate('tenant-paypal', 'ACTIVE_PAYMENT_GATEWAY');

    // Step 3: Simulate gRPC network failure
    mockRpc.nextError = new Error('UNAVAILABLE: config-service is down');

    // Step 4: Call again; should fall back to last-known-good PAYPAL
    const gw2 = await client.getActiveGateway('tenant-paypal');
    assert.equal(gw2, 'PAYPAL');
    assert.equal(mockRpc.callCount, 2);
  });

  await t.test('Fallback to default environment when no last-known-good exists', async () => {
    const mockRpc = new MockConfigServiceRpc();
    mockRpc.nextError = new Error('DEADLINE_EXCEEDED');
    const client = new ConfigGrpcClient('dummy:50053', mockRpc);

    const gw = await client.getActiveGateway('new-tenant-no-cache');
    assert.equal(gw, process.env.DEFAULT_PAYMENT_GATEWAY || 'STRIPE');
  });

  await t.test('Tenant isolation: caches gateways per tenant', async () => {
    const mockRpc = new MockConfigServiceRpc();
    const client = new ConfigGrpcClient('dummy:50053', mockRpc);

    const gwAlpha = await client.getActiveGateway('tenant-alpha');
    const gwBeta = await client.getActiveGateway('tenant-paypal');

    assert.equal(gwAlpha, 'STRIPE');
    assert.equal(gwBeta, 'PAYPAL');
    assert.equal(mockRpc.callCount, 2);
  });
});
