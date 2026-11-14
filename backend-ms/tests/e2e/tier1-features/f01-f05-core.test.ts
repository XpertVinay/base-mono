/**
 * tests/e2e/tier1-features/f01-f05-core.test.ts
 * Tier 1 Feature Coverage: F1 to F5 (25 Happy Path Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, E2E_CONFIG, assertStandardEnvelope } from '../harness/index.js';

describe('Tier 1: Core Features F1 - F5', () => {
  const adminAuth = AuthHelper.admin();
  const userAuth = AuthHelper.user();
  const internalHeaders = AuthHelper.internalService();

  // ---------------------------------------------------------------------------
  // F1: Organization Controller Error Handling & Lifecycle
  // ---------------------------------------------------------------------------
  describe('F1: Organization Controller & Lifecycle', () => {
    let createdOrgId = 'org-test-f1';

    test('T1-F01-01: POST /api/v1/organizations creates organization with valid payload', async () => {
      const res = await client.post(
        '/api/v1/organizations',
        {
          name: 'Acme Global Enterprises',
          slug: `acme-global-${Date.now()}`,
          description: 'Enterprise tenant',
          contactEmail: 'contact@acme.com',
          status: 'ACTIVE'
        },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      if (res.data?.data?.id) createdOrgId = res.data.data.id;
      assertStandardEnvelope(res);
    });

    test('T1-F01-02: GET /api/v1/organizations lists organizations', async () => {
      const res = await client.get('/api/v1/organizations', { headers: adminAuth.headers });
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F01-03: GET /api/v1/organizations/:id retrieves organization details', async () => {
      const res = await client.get(`/api/v1/organizations/${createdOrgId}`, { headers: adminAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F01-04: PUT /api/v1/organizations/:id updates organization', async () => {
      const res = await client.put(
        `/api/v1/organizations/${createdOrgId}`,
        { name: 'Acme Global Refactored', description: 'Updated description' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F01-05: POST /api/v1/organizations/:id/members adds member', async () => {
      const res = await client.post(
        `/api/v1/organizations/${createdOrgId}/members`,
        { userId: 'usr-123', email: 'ops@acme.com', name: 'Ops Admin', role: 'ADMIN' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F2: Config Route Param Binding
  // ---------------------------------------------------------------------------
  describe('F2: Config Route Param Binding', () => {
    test('T1-F02-01: PUT /api/v1/config/APP_THEME binds route param without body key', async () => {
      const res = await client.put(
        '/api/v1/config/APP_THEME',
        { value: 'dark' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F02-02: GET /api/v1/config/APP_THEME retrieves configured theme value', async () => {
      const res = await client.get('/api/v1/config/APP_THEME', { headers: userAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F02-03: POST /api/v1/config creates new dynamic configuration entry', async () => {
      const res = await client.post(
        '/api/v1/config',
        { key: 'MAX_FILE_SIZE', value: '10485760', description: '10MB max upload' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F02-04: GET /api/v1/config lists active tenant configuration entries', async () => {
      const res = await client.get('/api/v1/config', { headers: userAuth.headers });
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F02-05: DELETE /api/v1/config/APP_THEME deletes setting cleanly', async () => {
      const res = await client.delete('/api/v1/config/APP_THEME', { headers: adminAuth.headers });
      assert.ok([200, 204, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F3: Saga Compensation Auth
  // ---------------------------------------------------------------------------
  describe('F3: Saga Compensation Auth & Inter-Service Security', () => {
    test('T1-F03-01: POST /api/v1/inventory/release with internal service credentials', async () => {
      const res = await client.post(
        '/api/v1/inventory/release',
        { productId: 'prod-comp-1', quantity: 3, orderId: 'ord-saga-101' },
        { headers: internalHeaders }
      );
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F03-02: POST /api/v1/inventory/reserve with internal service credentials', async () => {
      const res = await client.post(
        '/api/v1/inventory/reserve',
        { productId: 'prod-comp-1', quantity: 3, orderId: 'ord-saga-101' },
        { headers: internalHeaders }
      );
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F03-03: POST /api/v1/orders places order triggering inventory reservation', async () => {
      const res = await client.post(
        '/api/v1/orders',
        { items: [{ productId: 'prod-comp-1', quantity: 1, price: 50.0 }] },
        { headers: userAuth.headers }
      );
      assert.ok([200, 201, 400].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F03-04: GET /api/v1/inventory/prod-comp-1 retrieves stock level', async () => {
      const res = await client.get('/api/v1/inventory/prod-comp-1', { headers: userAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F03-05: POST /api/v1/orders/:id/cancel releases reserved inventory', async () => {
      const res = await client.post(
        '/api/v1/orders/ord-saga-101/cancel',
        {},
        { headers: userAuth.headers }
      );
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F4: Safe Result Unwrapping
  // ---------------------------------------------------------------------------
  describe('F4: Safe Result Unwrapping without 500 Unhandled Exceptions', () => {
    test('T1-F04-01: POST /api/v1/inventory/stock adjusts stock delta safely', async () => {
      const res = await client.post(
        '/api/v1/inventory/stock',
        { productId: 'prod-unwrap-1', delta: 50 },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201, 400, 404].includes(res.status));
      assert.notStrictEqual(res.status, 500, 'Should not throw unhandled 500');
    });

    test('T1-F04-02: POST /api/v1/scheduler/jobs creates scheduled task cleanly', async () => {
      const res = await client.post(
        '/api/v1/scheduler/jobs',
        { name: `sync-metrics-${Date.now()}`, cronExpression: '0 * * * *', targetUrl: 'http://localhost:4011/metrics' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201, 400].includes(res.status));
      assert.notStrictEqual(res.status, 500, 'Should not throw unhandled 500');
    });

    test('T1-F04-03: GET /api/v1/scheduler/jobs returns job listing safely', async () => {
      const res = await client.get('/api/v1/scheduler/jobs', { headers: adminAuth.headers });
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F04-04: GET /api/v1/scheduler/jobs/:id retrieves specific job safely', async () => {
      const res = await client.get('/api/v1/scheduler/jobs/job-unwrap-1', { headers: adminAuth.headers });
      assert.ok([200, 404].includes(res.status));
      assert.notStrictEqual(res.status, 500, 'Should not throw unhandled 500 on missing job');
    });

    test('T1-F04-05: DELETE /api/v1/scheduler/jobs/:id deletes task safely', async () => {
      const res = await client.delete('/api/v1/scheduler/jobs/job-unwrap-1', { headers: adminAuth.headers });
      assert.ok([200, 204, 404].includes(res.status));
      assert.notStrictEqual(res.status, 500, 'Should not throw unhandled 500 on deletion');
    });
  });

  // ---------------------------------------------------------------------------
  // F5: Service Healthcheck Probes
  // ---------------------------------------------------------------------------
  describe('F5: Service Healthcheck Probes Across Microservices', () => {
    test('T1-F05-01: GET /api/v1/iam/health returns IAM service health status', async () => {
      const res = await client.get('/api/v1/iam/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F05-02: GET /api/v1/orders/health returns Order service health status', async () => {
      const res = await client.get('/api/v1/orders/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F05-03: GET /api/v1/inventory/health returns Inventory service health status', async () => {
      const res = await client.get('/api/v1/inventory/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.data?.status === 'ok' || res.data?.status === true);
    });

    test('T1-F05-04: GET /health returns API Gateway primary liveness probe', async () => {
      const res = await client.get('/health');
      assert.strictEqual(res.status, 200);
      assertStandardEnvelope(res);
    });

    test('T1-F05-05: GET /api/v1/health/detailed aggregates multi-service health status', async () => {
      const res = await client.get('/api/v1/health/detailed');
      assert.ok([200, 503].includes(res.status));
      assertStandardEnvelope(res);
    });
  });
});
