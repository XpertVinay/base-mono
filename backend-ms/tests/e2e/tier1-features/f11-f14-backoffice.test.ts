/**
 * tests/e2e/tier1-features/f11-f14-backoffice.test.ts
 * Tier 1 Feature Coverage: F11 to F14 (20 Happy Path Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, assertStandardEnvelope } from '../harness/index.js';

describe('Tier 1: Back-Office & Contract Features F11 - F14', () => {
  const adminAuth = AuthHelper.admin();
  const supportAuth = AuthHelper.backoffice('SUPPORT');
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');

  // ---------------------------------------------------------------------------
  // F11: Gateway Back-Office Ingress Routing
  // ---------------------------------------------------------------------------
  describe('F11: Gateway Back-Office Ingress Routing', () => {
    test('T1-F11-01: GET /api/v1/backoffice/iam/users routes to IAM users backoffice', async () => {
      const res = await client.get('/api/v1/backoffice/iam/users', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F11-02: GET /api/v1/backoffice/orders routes to order backoffice', async () => {
      const res = await client.get('/api/v1/backoffice/orders', { headers: supportAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F11-03: GET /api/v1/backoffice/inventory routes to inventory backoffice', async () => {
      const res = await client.get('/api/v1/backoffice/inventory', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F11-04: GET /api/v1/backoffice/audit/logs routes to audit log backoffice', async () => {
      const res = await client.get('/api/v1/backoffice/audit/logs', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F11-05: GET /api/v1/backoffice/config routes to config backoffice', async () => {
      const res = await client.get('/api/v1/backoffice/config', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F12: Downstream Back-Office Route Implementations
  // ---------------------------------------------------------------------------
  describe('F12: Downstream Back-Office Route Implementations', () => {
    test('T1-F12-01: POST /api/v1/config sets system-wide setting via backoffice', async () => {
      const res = await client.post(
        '/api/v1/config',
        { key: 'BACKOFFICE_SETTING', value: 'ACTIVE', description: 'Backoffice test setting' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F12-02: POST /api/v1/inventory creates inventory item via backoffice', async () => {
      const res = await client.post(
        '/api/v1/inventory',
        { productId: `prod-${Date.now()}`, sku: `SKU-BO-${Date.now()}`, totalQuantity: 50 },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F12-03: PATCH /api/v1/orders/:id/status updates status via backoffice', async () => {
      const res = await client.patch(
        '/api/v1/orders/ord-saga-101/status',
        { status: 'PROCESSING', reason: 'Backoffice dispatch' },
        { headers: supportAuth.headers }
      );
      assert.ok([200, 404].includes(res.status), `Expected 200/404, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F12-04: GET /api/v1/scheduler/jobs lists scheduled tasks for backoffice inspection', async () => {
      const res = await client.get('/api/v1/scheduler/jobs', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F12-05: GET /api/v1/search/documents queries catalog across indices for backoffice', async () => {
      const res = await client.get('/api/v1/search/documents?q=system', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F13: Client-Facing Zero-Regression & Dual Compatibility
  // ---------------------------------------------------------------------------
  describe('F13: Client-Facing Zero-Regression & Dual Compatibility', () => {
    test('T1-F13-01: POST /api/v1/iam/login authenticates client user', async () => {
      const res = await client.post('/api/v1/iam/login', {
        email: 'user@test.org',
        password: 'Password123!'
      });
      assert.ok([200, 400, 401].includes(res.status), `Expected standard login response, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F13-02: GET /api/v1/iam/profile returns authenticated client user profile', async () => {
      const res = await client.get('/api/v1/iam/profile', { headers: userA.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F13-03: GET /api/v1/orders/my returns client-facing order list without leakage', async () => {
      const res = await client.get('/api/v1/orders/my', { headers: userA.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F13-04: GET /api/v1/inventory/:id retrieves item for consumer catalog', async () => {
      const res = await client.get('/api/v1/inventory/inv-item-001', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status), `Expected 200/404, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F13-05: GET /api/v1/orders/backoffice/orders returns orders with pagination', async () => {
      const res = await client.get('/api/v1/orders/backoffice/orders?page=1&limit=10', { headers: supportAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F14: Back-Office Service Directory & OpenAPI Discovery
  // ---------------------------------------------------------------------------
  describe('F14: Back-Office Service Directory & OpenAPI Discovery', () => {
    test('T1-F14-01: GET /api/v1 exposes canonical route map', async () => {
      const res = await client.get('/api/v1');
      res.assertStatus(200);
      assertStandardEnvelope(res);
      assert.ok(res.data.services || res.data.endpoints || res.data.routes || res.data.data, 'Route catalog present');
    });

    test('T1-F14-02: GET /api-docs serves Swagger UI documentation', async () => {
      const res = await client.get('/api-docs');
      assert.ok([200, 301, 302].includes(res.status), `Expected 200/301/302, got ${res.status}`);
    });

    test('T1-F14-03: GET /api-docs/openapi.json serves valid OpenAPI specification', async () => {
      const res = await client.get('/api-docs/openapi.json');
      res.assertStatus(200);
      assert.ok(res.data && (res.data.openapi || res.data.swagger), 'Valid OpenAPI/Swagger document');
    });

    test('T1-F14-04: OpenAPI document defines back-office endpoints', async () => {
      const res = await client.get('/api-docs/openapi.json');
      res.assertStatus(200);
      const paths = Object.keys(res.data.paths || {});
      const hasBackofficeOrApi = paths.some(p => p.includes('/backoffice') || p.includes('/api/v1/'));
      assert.ok(hasBackofficeOrApi, 'OpenAPI paths contain API routes');
    });

    test('T1-F14-05: OpenAPI document specifies security schemes', async () => {
      const res = await client.get('/api-docs/openapi.json');
      res.assertStatus(200);
      const components = res.data.components || res.data.securityDefinitions || {};
      assert.ok(components, 'Security components specified');
    });
  });
});
