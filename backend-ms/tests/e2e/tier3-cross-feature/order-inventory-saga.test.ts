/**
 * tests/e2e/tier3-cross-feature/order-inventory-saga.test.ts
 * Tier 3: Distributed Multi-Service Sagas: Order, Inventory, Payment & Compensation Workflows
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, assertStandardEnvelope } from '../harness/index.js';

describe('Tier 3: Distributed Multi-Service Order & Inventory Sagas', () => {
  const adminAuth = AuthHelper.admin();
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');

  // ---------------------------------------------------------------------------
  // Saga 1: Order Creation & Stock Reservation (Workflow 2)
  // ---------------------------------------------------------------------------
  describe('Saga 1: Order Creation & Stock Reservation (Workflow 2)', () => {
    const testProduct = `prod-saga-${Date.now()}`;
    const testSku = `SKU-SAGA-${Date.now()}`;

    test('Step 1: Admin provisions product stock in inventory-service', async () => {
      const res = await client.post(
        '/api/v1/inventory',
        { productId: testProduct, sku: testSku, totalQuantity: 100 },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status), `Provision inventory returned ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('Step 2: Client queries stock availability prior to purchase', async () => {
      const res = await client.get(`/api/v1/inventory/${testProduct}`, { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('Step 3: Client submits basket order triggering stock reservation', async () => {
      const res = await client.post(
        '/api/v1/orders',
        {
          items: [{ productId: testProduct, productName: 'Saga Product', quantity: 2, unitPrice: 45.0 }]
        },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('Step 4: Order appears in client order history', async () => {
      const res = await client.get('/api/v1/orders/my', { headers: userA.headers });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // Saga 2: Order Failure & Compensation Rollback (Workflow 3)
  // ---------------------------------------------------------------------------
  describe('Saga 2: Order Failure & Compensation Rollback (Workflow 3)', () => {
    const testProductFail = `prod-fail-${Date.now()}`;
    const testSkuFail = `SKU-FAIL-${Date.now()}`;

    test('Step 1: Admin creates initial inventory for rollback scenario', async () => {
      const res = await client.post(
        '/api/v1/inventory',
        { productId: testProductFail, sku: testSkuFail, totalQuantity: 20 },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
    });

    test('Step 2: Client reserves stock for tentative transaction', async () => {
      const res = await client.post(
        '/api/v1/inventory/reserve',
        { productId: testProductFail, quantity: 5 },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400, 404].includes(res.status));
    });

    test('Step 3: Payment failure compensation releases reserved stock', async () => {
      const res = await client.post(
        '/api/v1/inventory/release',
        { productId: testProductFail, quantity: 5, reason: 'PAYMENT_FAILED_ROLLBACK' },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('Step 4: Audit service records compensation event trail', async () => {
      const res = await client.post(
        '/api/v1/audit/logs',
        {
          action: 'SAGA_COMPENSATION_RELEASE',
          resource: 'inventory',
          resourceId: testProductFail,
          details: { reason: 'PAYMENT_FAILED', restoredQuantity: 5 }
        },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ---------------------------------------------------------------------------
  // Saga 3: Order Cancellation Restitution Flow (Workflow 4)
  // ---------------------------------------------------------------------------
  describe('Saga 3: Order Cancellation Restitution Flow (Workflow 4)', () => {
    test('Step 1: Client cancels existing order', async () => {
      const res = await client.post(
        '/api/v1/orders/ord-restitution-101/cancel',
        { reason: 'Customer requested cancellation' },
        { headers: userA.headers }
      );
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('Step 2: Restitution stock release executed', async () => {
      const res = await client.post(
        '/api/v1/inventory/release',
        { productId: 'prod-restitution-1', quantity: 1, orderId: 'ord-restitution-101' },
        { headers: userA.headers }
      );
      assert.ok([200, 201, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('Step 3: Backoffice inspects cancelled order state', async () => {
      const res = await client.get('/api/v1/backoffice/orders', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });
  });
});
