import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Order } from '../src/domain/entities/order.entity.js';
import { IOrderRepository, ListOrdersOptions } from '../src/domain/repositories/order-repository.interface.js';

class InMemoryOrderRepo implements IOrderRepository {
  public orders: Order[] = [];

  async findById(id: string, tenantId?: string): Promise<Order | null> {
    const order = this.orders.find(o => o.id === id);
    if (!order) return null;
    if (tenantId && order.tenantId !== tenantId && order.tenantId !== 'default') return null;
    return order;
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Order[]> {
    return this.orders.filter(
      o => o.userId === userId && (!tenantId || o.tenantId === tenantId || o.tenantId === 'default')
    );
  }

  async findAll(tenantId?: string, options: ListOrdersOptions = {}): Promise<{ orders: Order[]; total: number }> {
    let filtered = this.orders.filter(
      o => !tenantId || o.tenantId === tenantId || o.tenantId === 'default'
    );
    if (options.status) {
      filtered = filtered.filter(o => o.status === options.status);
    }
    if (options.userId) {
      filtered = filtered.filter(o => o.userId === options.userId);
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const orders = filtered.slice(start, start + limit);
    return { orders, total: filtered.length };
  }

  async save(order: Order): Promise<void> {
    const existing = this.orders.findIndex(o => o.id === order.id);
    if (existing >= 0) {
      this.orders[existing] = order;
    } else {
      this.orders.push(order);
    }
  }

  async update(order: Order): Promise<void> {
    const existing = this.orders.findIndex(o => o.id === order.id);
    if (existing >= 0) {
      this.orders[existing] = order;
    }
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.orders.findIndex(
      o => o.id === id && (!tenantId || o.tenantId === tenantId || o.tenantId === 'default')
    );
    if (idx >= 0) {
      this.orders.splice(idx, 1);
      return true;
    }
    return false;
  }
}

function makeHttpRequest(
  app: Express,
  method: string,
  urlPath: string,
  body?: any,
  headers: Record<string, string> = {}
): Promise<{ status: number; headers: Record<string, any>; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) { cb(); }
    }) as any;
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = urlPath;

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const bodyStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;
    if (bodyStr !== undefined) {
      normalizedHeaders['content-type'] = normalizedHeaders['content-type'] || 'application/json';
      normalizedHeaders['content-length'] = String(Buffer.byteLength(bodyStr));
    }
    req.headers = normalizedHeaders;

    const res = new http.ServerResponse(req);
    const chunks: Buffer[] = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);

    res.write = ((chunk: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk?: any, ...args: any[]) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsedBody: any = null;
      const headerSep = raw.indexOf('\r\n\r\n');
      const bodyPart = headerSep >= 0 && raw.startsWith('HTTP/') ? raw.slice(headerSep + 4) : raw;
      try {
        parsedBody = bodyPart ? JSON.parse(bodyPart) : null;
      } catch {
        parsedBody = bodyPart;
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: parsedBody
      });
      return origEnd(chunk, ...args);
    }) as any;

    (app as any).handle(req, res, (err: any) => { if (err) reject(err); });

    if (bodyStr !== undefined) {
      req.push(bodyStr);
    }
    req.push(null);
  });
}

function createToken(role = 'ADMIN', tenantId = 'tenant-corp', userId = 'usr-admin-1'): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(
    { sub: userId, role, tenantId, email: `${userId}@corp.io` },
    secret,
    { expiresIn: '1h' }
  );
}

test('Order Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemoryOrderRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  // Pre-seed an order directly in repository
  const seedOrder = Order.create(
    'usr-cust-123',
    [{ productId: 'prod-item-1', productName: 'Item One', quantity: 2, unitPrice: 50 }],
    'USD',
    'ord-seeded-101',
    'tenant-corp'
  );
  await repo.save(seedOrder);

  await t.test('1. RBAC: User cannot access backoffice orders list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/orders', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. List Orders: GET /api/v1/orders returns backoffice list with pagination', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/orders?page=1&limit=10', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.meta_data.pagination.total, 1);
  });

  await t.test('3. Get Order: GET /api/v1/orders/:id returns detail by ID', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/orders/ord-seeded-101', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, 'ord-seeded-101');
    assert.strictEqual(res.body.data.totalAmount, 100);
  });

  await t.test('4. Update Status: PATCH /api/v1/orders/:id/status updates status to PROCESSING', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      '/api/v1/orders/ord-seeded-101/status',
      { status: 'PROCESSING', reason: 'Order verified by backoffice' },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.status, 'PROCESSING');
  });

  await t.test('5. Update Order: PATCH /api/v1/orders/:id updates totalAmount and currency', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      '/api/v1/orders/ord-seeded-101',
      { totalAmount: 120, currency: 'EUR' },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.totalAmount, 120);
    assert.strictEqual(res.body.data.currency, 'EUR');
  });

  await t.test('6. Delete Order: DELETE /api/v1/orders/:id removes order', async () => {
    const res = await makeHttpRequest(app, 'DELETE', '/api/v1/orders/ord-seeded-101', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);

    // Verify lookup fails
    const lookup = await makeHttpRequest(app, 'GET', '/api/v1/orders/ord-seeded-101', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('7. Route Aliases: Works under /api/v1/orders/backoffice/orders', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/orders/backoffice/orders', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('8. Order Cancellation Status Codes: 404 for not found, 403 for unauthorized (D8 fix)', async () => {
    // 1. Non-existent order cancellation returns 404
    const notFoundRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/orders/non-existent-order-id/cancel',
      undefined,
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(notFoundRes.status, 404);

    // 2. Seed an order owned by user-alice
    const aliceOrder = Order.create(
      'user-alice',
      [{ productId: 'p1', productName: 'Item A', quantity: 1, unitPrice: 20 }],
      'USD',
      'ord-alice-101',
      'tenant-corp'
    );
    await repo.save(aliceOrder);

    // 3. User bob attempts to cancel alice order -> 403 Forbidden
    const bobToken = createToken('USER', 'tenant-corp', 'user-bob');
    const forbiddenRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/orders/ord-alice-101/cancel',
      undefined,
      {
        Authorization: `Bearer ${bobToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(forbiddenRes.status, 403);
  });

  await t.test('9. Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/orders and /api/backoffice/orders', async () => {
    const resV1 = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/orders', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resV1.status, 200);
    assert.strictEqual(resV1.body.status, true);

    const resUnversioned = await makeHttpRequest(app, 'GET', '/api/backoffice/orders', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resUnversioned.status, 200);
    assert.strictEqual(resUnversioned.body.status, true);
  });

  await t.test('10. F22 Parameter Validation: Rejects whitespace-only order ID with 400', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/orders/%20%20', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 400);
  });
});

