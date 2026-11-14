import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { Asset } from '../src/domain/entities/asset.entity.js';
import { IAssetRepository, ListAssetsOptions } from '../src/domain/repositories/asset-repository.interface.js';

class InMemoryAssetRepo implements IAssetRepository {
  public assets: Asset[] = [];

  async findById(id: string, tenantId?: string): Promise<Asset | null> {
    const asset = this.assets.find(a => a.id === id);
    if (!asset) return null;
    if (tenantId && asset.tenantId !== tenantId && asset.tenantId !== 'default') return null;
    return asset;
  }

  async findByOwnerId(ownerId: string, tenantId?: string): Promise<Asset[]> {
    return this.assets.filter(
      a => a.ownerId === ownerId && (!tenantId || a.tenantId === tenantId || a.tenantId === 'default')
    );
  }

  async findAll(tenantId?: string, options: ListAssetsOptions = {}): Promise<{ assets: Asset[]; total: number }> {
    let filtered = this.assets.filter(
      a => !tenantId || a.tenantId === tenantId || a.tenantId === 'default'
    );
    if (options.ownerId) {
      filtered = filtered.filter(a => a.ownerId === options.ownerId);
    }
    if (options.search) {
      const s = options.search.toLowerCase();
      filtered = filtered.filter(a => a.name.toLowerCase().includes(s) || a.mimeType.toLowerCase().includes(s));
    }
    const page = options.page || 1;
    const limit = options.limit || 20;
    const start = (page - 1) * limit;
    const assets = filtered.slice(start, start + limit);
    return { assets, total: filtered.length };
  }

  async save(asset: Asset): Promise<void> {
    const existing = this.assets.findIndex(a => a.id === asset.id);
    if (existing >= 0) {
      this.assets[existing] = asset;
    } else {
      this.assets.push(asset);
    }
  }

  async update(asset: Asset): Promise<void> {
    const existing = this.assets.findIndex(a => a.id === asset.id);
    if (existing >= 0) {
      this.assets[existing] = asset;
    }
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const idx = this.assets.findIndex(
      a => a.id === id && (!tenantId || a.tenantId === tenantId || a.tenantId === 'default')
    );
    if (idx >= 0) {
      this.assets.splice(idx, 1);
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

test('Asset Service: Back-office CRUD Operations', async (t) => {
  const repo = new InMemoryAssetRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-corp');
  const supportToken = createToken('SUPPORT', 'tenant-corp');
  const userToken = createToken('USER', 'tenant-corp');

  let assetId = '';

  await t.test('1. RBAC: User cannot access backoffice asset list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/assets', undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 403);
  });

  await t.test('2. Create Asset: POST /api/v1/assets creates asset record', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/assets',
      {
        name: 'contracts-2026.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1048576,
        storagePath: '/storage/tenant-corp/contracts-2026.pdf'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp',
        'X-User-ID': 'usr-admin-1'
      }
    );
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.name, 'contracts-2026.pdf');
    assetId = res.body.data.id;
    assert.ok(assetId);
  });

  await t.test('3. List Assets: GET /api/v1/assets returns backoffice asset list', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/assets?page=1&limit=10', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.meta_data.pagination.total, 1);
  });

  await t.test('4. Get Asset: GET /api/v1/assets/:id returns detail by ID', async () => {
    const res = await makeHttpRequest(app, 'GET', `/api/v1/assets/${assetId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.id, assetId);
    assert.strictEqual(res.body.data.name, 'contracts-2026.pdf');
  });

  await t.test('4b. Owner Access & IDOR Protection: Owner can inspect asset, other user is blocked with 403 (D7 fix)', async () => {
    // 1. User creates asset
    const created = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/assets',
      {
        name: 'user-doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 512,
        storagePath: '/storage/tenant-corp/user-doc.pdf'
      },
      {
        Authorization: `Bearer ${userToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(created.status, 201);
    const userAssetId = created.body.data.id;

    // 2. Owner fetches asset via GET /:id -> 200 OK
    const ownerRes = await makeHttpRequest(app, 'GET', `/api/v1/assets/${userAssetId}`, undefined, {
      Authorization: `Bearer ${userToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.body.data.id, userAssetId);

    // 3. Different user attempts to inspect owner asset -> 403 Forbidden
    const otherUserToken = createToken('USER', 'tenant-corp', 'usr-intruder');
    const forbiddenRes = await makeHttpRequest(app, 'GET', `/api/v1/assets/${userAssetId}`, undefined, {
      Authorization: `Bearer ${otherUserToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(forbiddenRes.status, 403);
  });

  await t.test('5. Update Asset: PATCH /api/v1/assets/:id updates metadata', async () => {
    const res = await makeHttpRequest(
      app,
      'PATCH',
      `/api/v1/assets/${assetId}`,
      {
        name: 'contracts-2026-final.pdf',
        sizeBytes: 2097152
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.name, 'contracts-2026-final.pdf');
    assert.strictEqual(res.body.data.sizeBytes, 2097152);
  });

  await t.test('6. Delete Asset: DELETE /api/v1/assets/:id removes asset', async () => {
    const res = await makeHttpRequest(app, 'DELETE', `/api/v1/assets/${assetId}`, undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.deleted, true);

    // Verify subsequent lookup fails
    const lookup = await makeHttpRequest(app, 'GET', `/api/v1/assets/${assetId}`, undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(lookup.status, 404);
  });

  await t.test('7. Route Aliases: Works under /api/v1/assets/backoffice/assets', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/assets/backoffice/assets', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
  });

  await t.test('8. Canonical Back-Office Routes (F12): Works under /api/v1/backoffice/assets and /api/backoffice/assets', async () => {
    const resV1 = await makeHttpRequest(app, 'GET', '/api/v1/backoffice/assets', undefined, {
      Authorization: `Bearer ${adminToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resV1.status, 200);
    assert.strictEqual(resV1.body.status, true);

    const resUnversioned = await makeHttpRequest(app, 'GET', '/api/backoffice/assets', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(resUnversioned.status, 200);
    assert.strictEqual(resUnversioned.body.status, true);
  });

  await t.test('9. F22 Path Traversal Protection: Rejects storagePath containing traversal (..) or null byte', async () => {
    // 1. Directory traversal rejected
    const traversalRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/assets',
      {
        name: 'exploit.txt',
        mimeType: 'text/plain',
        sizeBytes: 128,
        storagePath: '../../etc/passwd'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(traversalRes.status, 400);

    // 2. Null byte rejected
    const nullByteRes = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/assets',
      {
        name: 'exploit.txt',
        mimeType: 'text/plain',
        sizeBytes: 128,
        storagePath: 'uploads/file\0.png'
      },
      {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-ID': 'tenant-corp'
      }
    );
    assert.strictEqual(nullByteRes.status, 400);
  });

  await t.test('10. F22 Parameter Validation: Rejects whitespace-only asset ID with 400', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/assets/%20%20', undefined, {
      Authorization: `Bearer ${supportToken}`,
      'X-Tenant-ID': 'tenant-corp'
    });
    assert.strictEqual(res.status, 400);
  });
});
