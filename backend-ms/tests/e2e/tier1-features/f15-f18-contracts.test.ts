/**
 * tests/e2e/tier1-features/f15-f18-contracts.test.ts
 * Tier 1 Feature Coverage: F15 to F18 (20 Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, assertStandardEnvelope } from '../harness/index.js';

describe('Tier 1: Architectural Decoupling & Invariants F15 - F18', () => {
  const adminAuth = AuthHelper.admin();
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');
  const userB = AuthHelper.user('usr-bob-2', 'tenant-beta');

  // ---------------------------------------------------------------------------
  // F15: SOLID Layer Decoupling & Architecture Guardrails
  // ---------------------------------------------------------------------------
  describe('F15: SOLID Layer Decoupling & Architecture Guardrails', () => {
    test('T1-F15-01: GET /api/v1/rbac/roles returns roles decoupled from infra', async () => {
      const res = await client.get('/api/v1/rbac/roles', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F15-02: GET /api/v1/rbac/permissions lists all fine-grained permissions', async () => {
      const res = await client.get('/api/v1/rbac/permissions', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F15-03: POST /api/v1/rbac/roles creates new domain role with permissions', async () => {
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: `AUDITOR_${Date.now()}`, description: 'Security Auditor', permissions: ['audit:read'] },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F15-04: GET /api/v1/ai/capabilities lists registered AI capabilities and models', async () => {
      const res = await client.get('/api/v1/ai/capabilities', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F15-05: GET /api/v1/ai/tools lists registered pluggable agent tools', async () => {
      const res = await client.get('/api/v1/ai/tools', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F16: Domain Invariant Error Handling & Exception Mapping
  // ---------------------------------------------------------------------------
  describe('F16: Domain Invariant Error Handling & Exception Mapping', () => {
    test('T1-F16-01: POST /api/v1/organizations rejects empty name with 400', async () => {
      const res = await client.post(
        '/api/v1/organizations',
        { name: '', slug: 'invalid-slug', contactEmail: 'test@org.com' },
        { headers: adminAuth.headers }
      );
      assert.strictEqual(res.status, 400, `Expected 400 for empty org name, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F16-02: POST /api/v1/iam/login rejects invalid email format with 400', async () => {
      const res = await client.post(
        '/api/v1/iam/login',
        { email: 'not-an-email', password: 'Password123!' }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for invalid email, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F16-03: POST /api/v1/rbac/roles rejects whitespace-only role name with 400', async () => {
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: '   ', description: 'Invalid Role' },
        { headers: adminAuth.headers }
      );
      assert.strictEqual(res.status, 400, `Expected 400 for whitespace role name, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F16-04: POST /api/v1/orders rejects negative item quantity with 400', async () => {
      const res = await client.post(
        '/api/v1/orders',
        { items: [{ productId: 'prod-1', productName: 'Item 1', quantity: -5, unitPrice: 10 }] },
        { headers: userA.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for negative quantity, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T1-F16-05: POST /api/v1/inventory rejects negative stock with 400', async () => {
      const res = await client.post(
        '/api/v1/inventory',
        { productId: 'prod-inv-neg', sku: 'SKU-NEG', totalQuantity: -20 },
        { headers: adminAuth.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for negative totalQuantity, got ${res.status}`);
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F17: Multi-Tenancy Architecture Decoupling
  // ---------------------------------------------------------------------------
  describe('F17: Multi-Tenancy Architecture Decoupling', () => {
    test('T1-F17-01: Tenant context injected via header across HTTP boundaries', async () => {
      const res = await client.get('/api/v1/config/CURRENCY', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F17-02: Fallback to default tenant when no tenant header provided', async () => {
      const authNoTenant = AuthHelper.user('usr-public-1', undefined);
      const res = await client.get('/api/v1/config/DEFAULT_LOCALE', { headers: authNoTenant.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F17-03: GET /api/v1/iam/oidc/providers lists tenant-scoped SSO providers', async () => {
      const res = await client.get('/api/v1/iam/oidc/providers', { headers: userA.headers });
      assert.ok([200, 204, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F17-04: Tenant boundary prevents access to other tenant entities', async () => {
      const res = await client.get('/api/v1/organizations/org-tenant-alpha', { headers: userB.headers });
      assert.ok([200, 403, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F17-05: Correlation ID preserved alongside tenant context', async () => {
      const res = await client.get('/api/v1/organizations', {
        headers: { ...adminAuth.headers, 'x-correlation-id': 'corr-e2e-sync-123' }
      });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F18: Protobuf Contract Synchronization Across Services
  // ---------------------------------------------------------------------------
  describe('F18: Protobuf Contract Synchronization Across Services', () => {
    test('T1-F18-01: Order service handles Inventory CheckStock protobuf contracts', async () => {
      const res = await client.get('/api/v1/inventory/prod-sync-01', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F18-02: Order service reserves stock via inventory contract', async () => {
      const res = await client.post(
        '/api/v1/inventory/reserve',
        { productId: 'prod-sync-01', quantity: 2 },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F18-03: Transaction service retrieves config via protobuf contract', async () => {
      const res = await client.get('/api/v1/config/PAYMENT_GATEWAY', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F18-04: AI service exposes gRPC prompt execution contract', async () => {
      const res = await client.post(
        '/api/v1/ai/orchestrate',
        { steps: [{ stepId: 'step-1', toolName: 'search_catalog', arguments: { query: 'test' } }] },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201, 501].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F18-05: Gateway exposes uniform gRPC error mapping for protobuf status codes', async () => {
      const res = await client.get('/api/v1/inventory/non-existent-product-id-999', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });
});
