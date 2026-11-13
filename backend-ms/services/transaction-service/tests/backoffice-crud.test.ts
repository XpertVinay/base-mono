import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Transaction } from '../src/domain/entities/transaction.entity.js';
import { ITransactionRepository, ListTransactionsOptions } from '../src/domain/repositories/transaction-repository.interface.js';

class InMemoryTransactionRepo implements ITransactionRepository {
  public transactions: Transaction[] = [];

  async findById(id: string, tenantId?: string): Promise<Transaction | null> {
    const txn = this.transactions.find(t => t.id === id);
    if (!txn) return null;
    if (tenantId && txn.tenantId !== tenantId && txn.tenantId !== 'default') return null;
    return txn;
  }

  async findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction | null> {
    const txn = this.transactions.find(
      t => t.referenceId === referenceId && (!tenantId || t.tenantId === tenantId || t.tenantId === 'default')
    );
    return txn || null;
  }

  async findAll(tenantId?: string, options: ListTransactionsOptions = {}): Promise<{ transactions: Transaction[]; total: number }> {
    let filtered = this.transactions.filter(
      t => !tenantId || t.tenantId === tenantId || t.tenantId === 'default'
    );
    if (options.status) {
      filtered = filtered.filter(t => t.status === options.status);
    }
    if (options.type) {
      filtered = filtered.filter(t => t.type === options.type);
    }
    if (options.userId) {
      filtered = filtered.filter(t => t.userId === options.userId);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(
        t => t.referenceId.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
      );
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return { transactions: items, total: filtered.length };
  }

  async save(transaction: Transaction): Promise<void> {
    const existing = this.transactions.findIndex(t => t.id === transaction.id);
    if (existing >= 0) {
      this.transactions[existing] = transaction;
    } else {
      this.transactions.push(transaction);
    }
  }

  async update(transaction: Transaction): Promise<void> {
    const existing = this.transactions.findIndex(t => t.id === transaction.id);
    if (existing >= 0) {
      this.transactions[existing] = transaction;
    }
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.transactions.findIndex(
      t => t.id === id && (!tenantId || t.tenantId === tenantId || t.tenantId === 'default')
    );
    if (idx >= 0) {
      this.transactions.splice(idx, 1);
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

    if (bodyStr !== undefined) {
      req.push(bodyStr);
    }
    req.push(null);

    try {
      (app as any).handle(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

function createToken(payload: { sub: string; email: string; role: string; tenantId: string }): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

test('Backoffice Transaction CRUD: RBAC permissions enforcement', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const userToken = createToken({ sub: 'user-1', email: 'user@test.local', role: 'USER', tenantId: 'tenant-1' });

  // 1. Unauthenticated request to GET /api/v1/transactions returns 401
  const unauthRes = await makeHttpRequest(app, 'GET', '/api/v1/transactions');
  assert.strictEqual(unauthRes.status, 401);

  // 2. USER role request to GET /api/v1/transactions returns 403 Forbidden
  const forbiddenRes = await makeHttpRequest(app, 'GET', '/api/v1/transactions', undefined, {
    Authorization: `Bearer ${userToken}`
  });
  assert.strictEqual(forbiddenRes.status, 403);
});

test('Backoffice Transaction CRUD: ADMIN manual transaction creation', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const createRes = await makeHttpRequest(
    app,
    'POST',
    '/api/v1/transactions',
    {
      referenceId: 'ref-inv-1001',
      userId: 'user-42',
      type: 'PAYMENT',
      amount: 25000,
      currency: 'USD',
      paymentMethod: 'WIRE_TRANSFER'
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.body.status, true);
  assert.strictEqual(createRes.body.data.referenceId, 'ref-inv-1001');
  assert.strictEqual(createRes.body.data.amount, 25000);
  assert.strictEqual(createRes.body.data.status, 'PENDING');
});

test('Backoffice Transaction CRUD: List transactions with pagination', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  // Seed 3 transactions
  for (let i = 1; i <= 3; i++) {
    const txn = Transaction.create(
      {
        tenantId: 'tenant-1',
        referenceId: `seed-ref-${i}`,
        userId: `user-${i}`,
        type: 'PAYMENT',
        amount: i * 1000,
        currency: 'USD',
        paymentMethod: 'CREDIT_CARD'
      },
      `txn-00${i}`
    );
    await repo.save(txn);
  }

  const listRes = await makeHttpRequest(app, 'GET', '/api/v1/transactions?limit=2&page=1', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.body.status, true);
  assert.strictEqual(listRes.body.data.length, 2);
  assert.strictEqual(listRes.body.meta_data.pagination.total, 3);
  assert.strictEqual(listRes.body.meta_data.pagination.limit, 2);
});

test('Backoffice Transaction CRUD: Get transaction by ID (SUPPORT and ADMIN)', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const txn = Transaction.create(
    {
      tenantId: 'tenant-1',
      referenceId: 'order-detail-99',
      userId: 'user-99',
      type: 'PAYMENT',
      amount: 4999,
      currency: 'USD',
      paymentMethod: 'STRIPE'
    },
    'txn-detail-1'
  );
  await repo.save(txn);

  const supportToken = createToken({ sub: 'support-1', email: 'support@test.local', role: 'SUPPORT', tenantId: 'tenant-1' });

  const getRes = await makeHttpRequest(app, 'GET', '/api/v1/transactions/txn-detail-1', undefined, {
    Authorization: `Bearer ${supportToken}`
  });

  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.status, true);
  assert.strictEqual(getRes.body.data.id, 'txn-detail-1');
  assert.strictEqual(getRes.body.data.amount, 4999);
});

test('Backoffice Transaction CRUD: Update transaction details', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const txn = Transaction.create(
    {
      tenantId: 'tenant-1',
      referenceId: 'ref-update-1',
      userId: 'user-1',
      type: 'PAYMENT',
      amount: 1000,
      currency: 'USD',
      paymentMethod: 'STRIPE'
    },
    'txn-update-1'
  );
  await repo.save(txn);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const updateRes = await makeHttpRequest(
    app,
    'PUT',
    '/api/v1/transactions/txn-update-1',
    {
      failureReason: 'Gateway timeout during verification',
      provider: 'STRIPE_GLOBAL',
      paymentMethod: 'ACH'
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.status, true);
  assert.strictEqual(updateRes.body.data.failureReason, 'Gateway timeout during verification');
  assert.strictEqual(updateRes.body.data.provider, 'STRIPE_GLOBAL');
});

test('Backoffice Transaction CRUD: Status override (ADMIN)', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const txn = Transaction.create(
    {
      tenantId: 'tenant-1',
      referenceId: 'ref-status-1',
      userId: 'user-1',
      type: 'PAYMENT',
      amount: 2000,
      currency: 'USD',
      paymentMethod: 'STRIPE'
    },
    'txn-status-1'
  );
  await repo.save(txn);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const patchRes = await makeHttpRequest(
    app,
    'PATCH',
    '/api/v1/transactions/txn-status-1/status',
    {
      status: 'CANCELLED',
      reason: 'Customer initiated chargeback'
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  assert.strictEqual(patchRes.status, 200);
  assert.strictEqual(patchRes.body.status, true);
  assert.strictEqual(patchRes.body.data.status, 'CANCELLED');
});

test('Backoffice Transaction CRUD: Delete transaction (ADMIN)', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const txn = Transaction.create(
    {
      tenantId: 'tenant-1',
      referenceId: 'ref-delete-1',
      userId: 'user-1',
      type: 'PAYMENT',
      amount: 3000,
      currency: 'USD',
      paymentMethod: 'STRIPE'
    },
    'txn-del-1'
  );
  await repo.save(txn);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const deleteRes = await makeHttpRequest(app, 'DELETE', '/api/v1/transactions/txn-del-1', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.body.status, true);

  const check = await repo.findById('txn-del-1');
  assert.strictEqual(check, null);
});

test('Backoffice Transaction CRUD: Path aliases (/backoffice/transactions)', async () => {
  const repo = new InMemoryTransactionRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const aliasRes = await makeHttpRequest(app, 'GET', '/api/v1/transactions/backoffice/transactions', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(aliasRes.status, 200);
  assert.strictEqual(aliasRes.body.status, true);
});
