import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { InventoryItem } from '../src/domain/entities/inventory.entity.js';
import { IInventoryRepository, ListInventoryOptions } from '../src/domain/repositories/inventory-repository.interface.js';

class InMemoryInventoryRepo implements IInventoryRepository {
  public items: InventoryItem[] = [];

  async findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null> {
    const item = this.items.find(i => i.productId === productId);
    if (!item) return null;
    if (tenantId && item.tenantId !== tenantId && item.tenantId !== 'default') return null;
    return item;
  }

  async findBySku(sku: string, tenantId?: string): Promise<InventoryItem | null> {
    const item = this.items.find(i => i.sku === sku);
    if (!item) return null;
    if (tenantId && item.tenantId !== tenantId && item.tenantId !== 'default') return null;
    return item;
  }

  async findAll(tenantId?: string, options: ListInventoryOptions = {}): Promise<{ items: InventoryItem[]; total: number }> {
    let filtered = this.items.filter(
      i => !tenantId || i.tenantId === tenantId || i.tenantId === 'default'
    );
    if (options.search) {
      const s = options.search.toLowerCase();
      filtered = filtered.filter(i => i.sku.toLowerCase().includes(s) || i.productId.toLowerCase().includes(s));
    }
    if (options.lowStock) {
      filtered = filtered.filter(i => i.availableQuantity <= 10);
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return { items, total: filtered.length };
  }

  async reserveAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const item = await this.findByProductId(productId, tenantId);
    if (!item) return null;
    const ok = item.reserve(quantity);
    return ok ? item : null;
  }

  async releaseAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const item = await this.findByProductId(productId, tenantId);
    if (!item) return null;
    item.release(quantity);
    return item;
  }

  async save(item: InventoryItem): Promise<void> {
    const existing = this.items.findIndex(i => i.productId === item.productId);
    if (existing >= 0) {
      this.items[existing] = item;
    } else {
      this.items.push(item);
    }
  }

  async update(item: InventoryItem): Promise<void> {
    const existing = this.items.findIndex(i => i.productId === item.productId);
    if (existing >= 0) {
      this.items[existing] = item;
    }
  }

  async delete(productId: string, tenantId?: string): Promise<boolean> {
    const idx = this.items.findIndex(
      i => i.productId === productId && (!tenantId || i.tenantId === tenantId || i.tenantId === 'default')
    );
    if (idx >= 0) {
      this.items.splice(idx, 1);
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

function createToken(role = 'ADMIN', tenantId = 'tenant-corp'): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(
    { sub: 'usr-admin-1', role, tenantId, email: 'admin@corp.io' },
    secret,
    { expiresIn: '1h' }
  );
}

test('Inventory Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemoryInventoryRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  await t.test('1. RBAC: User cannot access backoffice inventory list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/inventory', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. Create Item: POST /api/v1/inventory creates item record', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/inventory',
      {
        productId: 'prod-macbook-pro-16',
        sku: 'MBP-16-M3-MAX',
        totalQuantity: 50,
        availableQuantity: 50
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.productId, 'prod-macbook-pro-16');
    assert.strictEqual(res.body.data.sku, 'MBP-16-M3-MAX');
    assert.strictEqual(res.body.data.totalQuantity, 50);
  });

  await t.test('3. List Inventory: GET /api/v1/inventory returns backoffice item list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/inventory?page=1&limit=10', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.meta_data.pagination.total, 1);
  });

  await t.test('4. Get Item: GET /api/v1/inventory/:productId returns stock & detail', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/inventory/prod-macbook-pro-16', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.productId, 'prod-macbook-pro-16');
  });

  await t.test('5. Update Item: PATCH /api/v1/inventory/:productId updates SKU and totalQuantity', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      '/api/v1/inventory/prod-macbook-pro-16',
      {
        sku: 'MBP-16-M3-MAX-V2',
        totalQuantity: 75,
        availableQuantity: 75
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.sku, 'MBP-16-M3-MAX-V2');
    assert.strictEqual(res.body.data.totalQuantity, 75);
  });

  await t.test('6. Delete Item: DELETE /api/v1/inventory/:productId removes inventory item', async () => {
    const res = await makeHttpRequest(app, 'DELETE', '/api/v1/inventory/prod-macbook-pro-16', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);

    // Verify subsequent lookup fails
    const lookup = await makeHttpRequest(app, 'GET', '/api/v1/inventory/prod-macbook-pro-16', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('7. Route Aliases: Works under /api/v1/inventory/backoffice/items', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/inventory/backoffice/items', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('8. Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/inventory and /api/v1/backoffice/items', async () => {
    const resInv = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/inventory', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resInv.status, 200);
    assert.strictEqual(resInv.body.status, true);

    const resItems = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/items', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resItems.status, 200);
    assert.strictEqual(resItems.body.status, true);
  });
});

