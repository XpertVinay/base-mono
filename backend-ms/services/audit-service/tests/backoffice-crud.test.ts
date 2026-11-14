import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/domain/entities/audit-log.entity.js';
import { IAuditRepository, AuditQueryFilter } from '../src/domain/repositories/audit-repository.interface.js';

class InMemoryAuditRepo implements IAuditRepository {
  public logs: AuditLog[] = [];

  async save(log: AuditLog): Promise<void> {
    const existing = this.logs.findIndex(l => l.id === log.id);
    if (existing >= 0) {
      this.logs[existing] = log;
    } else {
      this.logs.push(log);
    }
  }

  async findById(id: string, tenantId?: string): Promise<AuditLog | null> {
    const log = this.logs.find(l => l.id === id);
    if (!log) return null;
    if (tenantId && log.tenantId !== tenantId && log.tenantId !== 'default') return null;
    return log;
  }

  async query(filter: AuditQueryFilter): Promise<AuditLog[]> {
    let filtered = this.logs.filter(
      l => !filter.tenantId || l.tenantId === filter.tenantId || l.tenantId === 'default'
    );
    if (filter.actorId) {
      filtered = filtered.filter(l => l.actorId === filter.actorId);
    }
    if (filter.resource) {
      filtered = filtered.filter(l => l.resource === filter.resource);
    }
    if (filter.action) {
      filtered = filtered.filter(l => l.action === filter.action);
    }
    if (filter.severity) {
      filtered = filtered.filter(l => l.severity === filter.severity);
    }
    const limit = filter.limit ? Math.min(filter.limit, 100) : 50;
    return filtered.slice(0, limit);
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const idx = this.logs.findIndex(
      l => l.id === id && l.tenantId === tid
    );
    if (idx >= 0) {
      this.logs.splice(idx, 1);
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

test('Backoffice Audit CRUD: RBAC permissions enforcement', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const userToken = createToken({ sub: 'user-1', email: 'user@test.local', role: 'USER', tenantId: 'tenant-1' });

  // 1. Unauthenticated request to GET /api/v1/audit/logs returns 401
  const unauthRes = await makeHttpRequest(app, 'GET', '/api/v1/audit/logs');
  assert.strictEqual(unauthRes.status, 401);

  // 2. USER role request to GET /api/v1/audit/logs returns 403 Forbidden
  const forbiddenRes = await makeHttpRequest(app, 'GET', '/api/v1/audit/logs', undefined, {
    Authorization: `Bearer ${userToken}`
  });
  assert.strictEqual(forbiddenRes.status, 403);
});

test('Backoffice Audit CRUD: Record audit log (POST /logs)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const postRes = await makeHttpRequest(
    app,
    'POST',
    '/api/v1/audit/logs',
    {
      action: 'USER_LOGIN',
      resource: 'IAMService',
      actorId: 'user-99',
      actorEmail: 'admin@enterprise.com',
      severity: 'INFO',
      tenantId: 'tenant-1',
      details: { ip: '10.0.0.1' }
    }
  );

  assert.strictEqual(postRes.status, 201);
  assert.strictEqual(postRes.body.status, true);
  assert.strictEqual(postRes.body.data.action, 'USER_LOGIN');
  assert.strictEqual(postRes.body.data.resource, 'IAMService');
});

test('Backoffice Audit CRUD: List audit logs with filters (ADMIN/SUPPORT)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  // Seed logs
  for (let i = 1; i <= 3; i++) {
    const log = AuditLog.create(
      {
        tenantId: 'tenant-1',
        action: `RESOURCE_ACCESSED_${i}`,
        resource: 'AssetService',
        severity: 'INFO'
      },
      `log-00${i}`
    );
    await repo.save(log);
  }

  const listRes = await makeHttpRequest(app, 'GET', '/api/v1/audit/logs?resource=AssetService', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.body.status, true);
  assert.strictEqual(listRes.body.data.length, 3);
});

test('Backoffice Audit CRUD: Get audit log by ID (SUPPORT and ADMIN)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const log = AuditLog.create(
    {
      tenantId: 'tenant-1',
      action: 'PAYMENT_CHARGED',
      resource: 'TransactionService',
      severity: 'WARN',
      details: { amount: 5000 }
    },
    'log-detail-1'
  );
  await repo.save(log);

  const supportToken = createToken({ sub: 'support-1', email: 'support@test.local', role: 'SUPPORT', tenantId: 'tenant-1' });

  const getRes = await makeHttpRequest(app, 'GET', '/api/v1/audit/logs/log-detail-1', undefined, {
    Authorization: `Bearer ${supportToken}`
  });

  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.status, true);
  assert.strictEqual(getRes.body.data.id, 'log-detail-1');
  assert.strictEqual(getRes.body.data.action, 'PAYMENT_CHARGED');
});

test('Backoffice Audit CRUD: Retention purge/delete log by ID (ADMIN only)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const log = AuditLog.create(
    {
      tenantId: 'tenant-1',
      action: 'GDPR_PURGE_TARGET',
      resource: 'UserService',
      severity: 'INFO'
    },
    'log-purge-1'
  );
  await repo.save(log);

  const supportToken = createToken({ sub: 'support-1', email: 'support@test.local', role: 'SUPPORT', tenantId: 'tenant-1' });
  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  // 1. SUPPORT role cannot purge audit log (must be ADMIN)
  const forbiddenPurge = await makeHttpRequest(app, 'DELETE', '/api/v1/audit/logs/log-purge-1', undefined, {
    Authorization: `Bearer ${supportToken}`
  });
  assert.strictEqual(forbiddenPurge.status, 403);

  // 2. ADMIN role successfully purges
  const deleteRes = await makeHttpRequest(app, 'DELETE', '/api/v1/audit/logs/log-purge-1', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.body.status, true);

  const check = await repo.findById('log-purge-1');
  assert.strictEqual(check, null);
});

test('Backoffice Audit CRUD: Path aliases (/backoffice/logs)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const aliasRes = await makeHttpRequest(app, 'GET', '/api/v1/audit/backoffice/logs', undefined, {
    Authorization: `Bearer ${adminToken}`
  });

  assert.strictEqual(aliasRes.status, 200);
  assert.strictEqual(aliasRes.body.status, true);
});

test('Audit Directory Discovery: GET /api/v1/audit returns 200 discovery metadata (D6 fix)', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const res = await makeHttpRequest(app, 'GET', '/api/v1/audit');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.service, 'audit-service');
  assert.ok(Array.isArray(res.body.endpoints));
});

test('Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/audit and /api/backoffice/audit', async () => {
  const repo = new InMemoryAuditRepo();
  const { app } = createApp(repo);

  const adminToken = createToken({ sub: 'admin-1', email: 'admin@test.local', role: 'ADMIN', tenantId: 'tenant-1' });

  const resV1 = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/audit/logs', undefined, {
    Authorization: `Bearer ${adminToken}`
  });
  assert.strictEqual(resV1.status, 200);
  assert.strictEqual(resV1.body.status, true);

  const resUnversioned = await makeHttpRequest(app, 'GET', '/api/backoffice/audit/logs', undefined, {
    Authorization: `Bearer ${adminToken}`
  });
  assert.strictEqual(resUnversioned.status, 200);
  assert.strictEqual(resUnversioned.body.status, true);
});

