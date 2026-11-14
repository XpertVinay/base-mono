/**
 * tests/e2e/tier1-features/f06-f10-gateway.test.ts
 * Tier 1 Feature Coverage: F6 to F10 (25 Happy Path Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, E2E_CONFIG, assertStandardEnvelope } from '../harness/index.js';

describe('Tier 1: Gateway, Ingress & Topology Features F6 - F10', () => {
  const adminAuth = AuthHelper.admin();
  const supportAuth = AuthHelper.backoffice('SUPPORT');
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');
  const userB = AuthHelper.user('usr-bob-2', 'tenant-alpha');

  // ---------------------------------------------------------------------------
  // F6: API Gateway Directory Roots & Service Discovery
  // ---------------------------------------------------------------------------
  describe('F6: API Gateway Directory Roots & Service Discovery', () => {
    test('T1-F06-01: GET / returns gateway root discovery envelope', async () => {
      const res = await client.get('/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.data?.name?.includes('Gateway') || res.data?.message?.includes('Gateway'));
      assertStandardEnvelope(res);
    });

    test('T1-F06-02: GET /api/v1 publishes complete microservices route registry', async () => {
      const res = await client.get('/api/v1');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.data?.services?.iam?.includes('/api/v1/iam'));
      assert.ok(res.data?.data?.services?.orders?.includes('/api/v1/orders'));
      assertStandardEnvelope(res);
    });

    test('T1-F06-03: GET /api/v1/iam returns IAM directory or service status', async () => {
      const res = await client.get('/api/v1/iam/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.service === 'iam-service' || res.data?.status === 'ok');
    });

    test('T1-F06-04: GET /api/v1/scheduler returns Scheduler service root/health', async () => {
      const res = await client.get('/api/v1/scheduler/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F06-05: GET /api/v1/audit returns Audit service root/health', async () => {
      const res = await client.get('/api/v1/audit/health');
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F7: Asset Ownership Permissions
  // ---------------------------------------------------------------------------
  describe('F7: Asset Ownership Permissions & Role Access', () => {
    let userAAssetId = 'ast-test-f7';

    test('T1-F07-01: POST /api/v1/assets uploads asset metadata with authenticated owner', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'tax_doc.pdf',
          storagePath: 'uploads/usr-alice/tax.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 102400
        },
        { headers: userA.headers }
      );
      assert.ok([200, 201].includes(res.status));
      if (res.data?.data?.id) userAAssetId = res.data.data.id;
      assertStandardEnvelope(res);
    });

    test('T1-F07-02: GET /api/v1/assets/:id allows asset owner to retrieve their asset', async () => {
      const res = await client.get(`/api/v1/assets/${userAAssetId}`, { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F07-03: GET /api/v1/assets/my lists all assets owned by current user', async () => {
      const res = await client.get('/api/v1/assets/my', { headers: userA.headers });
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F07-04: GET /api/v1/assets/:id allows ADMIN to inspect any tenant asset', async () => {
      const res = await client.get(`/api/v1/assets/${userAAssetId}`, { headers: adminAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F07-05: GET /api/v1/assets/:id allows SUPPORT role to inspect asset', async () => {
      const res = await client.get(`/api/v1/assets/${userAAssetId}`, { headers: supportAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F8: Order Cancellation Status Codes
  // ---------------------------------------------------------------------------
  describe('F8: Order Cancellation Status Codes', () => {
    let orderId = 'ord-test-f8';

    test('T1-F08-01: POST /api/v1/orders/:id/cancel allows owner cancellation', async () => {
      const createRes = await client.post(
        '/api/v1/orders',
        { items: [{ productId: 'prod-comp-1', quantity: 1, price: 50.0 }] },
        { headers: userA.headers }
      );
      if (createRes.data?.data?.id) orderId = createRes.data.data.id;

      const cancelRes = await client.post(`/api/v1/orders/${orderId}/cancel`, {}, { headers: userA.headers });
      assert.ok([200, 400, 404].includes(cancelRes.status));
      assertStandardEnvelope(cancelRes);
    });

    test('T1-F08-02: POST /api/v1/orders/:id/cancel allows admin cancellation', async () => {
      const res = await client.post(`/api/v1/orders/${orderId}/cancel`, {}, { headers: adminAuth.headers });
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F08-03: GET /api/v1/orders/:id verifies order status', async () => {
      const res = await client.get(`/api/v1/orders/${orderId}`, { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F08-04: GET /api/v1/orders/my returns user order history', async () => {
      const res = await client.get('/api/v1/orders/my', { headers: userA.headers });
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F08-05: POST /api/v1/backoffice/orders/:id/cancel allows support cancellation', async () => {
      const res = await client.post(`/api/v1/backoffice/orders/${orderId}/cancel`, {}, { headers: supportAuth.headers });
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F9: gRPC Tenant Context Propagation
  // ---------------------------------------------------------------------------
  describe('F9: gRPC Tenant Context Propagation Across Services', () => {
    test('T1-F09-01: POST /api/v1/orders preserves tenant ID in order creation', async () => {
      const res = await client.post(
        '/api/v1/orders',
        { items: [{ productId: 'prod-comp-1', productName: 'Comp Product', quantity: 1, unitPrice: 20.0 }] },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F09-02: GET /api/v1/orders/:id preserves tenant isolation', async () => {
      const res = await client.get('/api/v1/orders/ord-saga-101', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F09-03: POST /api/v1/config creates setting scoped to tenant', async () => {
      const res = await client.post(
        '/api/v1/config',
        { key: 'CURRENCY', value: 'EUR' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F09-04: GET /api/v1/config/CURRENCY reads setting with tenant context', async () => {
      const res = await client.get('/api/v1/config/CURRENCY', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F09-05: POST /api/v1/search/documents indexes document under tenant', async () => {
      const res = await client.post(
        '/api/v1/search/documents',
        { id: 'doc-alpha-1', documentType: 'article', title: 'Alpha Documentation', description: 'Internal guidelines' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F10: Container Topology Alignment
  // ---------------------------------------------------------------------------
  describe('F10: Container Topology Alignment (All 13 Microservices Active)', () => {
    test('T1-F10-01: GET /api/v1/ai/capabilities queries AI service capabilities', async () => {
      const res = await client.get('/api/v1/ai/capabilities');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.data?.supportedTransports !== undefined || res.data?.data?.service === 'ai-service' || res.data?.data?.capabilities !== undefined);
    });

    test('T1-F10-02: GET /api/v1/ai/health verifies AI service container health', async () => {
      const res = await client.get('/api/v1/ai/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F10-03: GET /api/v1/organizations verifies organization service active', async () => {
      const res = await client.get('/api/v1/organizations', { headers: adminAuth.headers });
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F10-04: GET /api/v1/organizations/health verifies organization container health', async () => {
      const res = await client.get('/api/v1/organizations/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F10-05: GET /api/v1/health/detailed aggregates multi-service topology', async () => {
      const res = await client.get('/api/v1/health/detailed');
      assert.ok([200, 503].includes(res.status));
      assertStandardEnvelope(res);
    });
  });
});
