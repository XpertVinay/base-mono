import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { ConfigSetting } from '../src/domain/entities/config.entity.js';
import { IConfigRepository } from '../src/domain/repositories/config-repository.interface.js';

class InMemoryConfigRepo implements IConfigRepository {
  public settings = new Map<string, ConfigSetting>();

  private key(k: string, tenantId?: string): string {
    return `${tenantId || 'default'}:${k}`;
  }

  async getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null> {
    const tid = tenantId || 'default';
    const tenantSpecific = this.settings.get(this.key(key, tid));
    if (tenantSpecific) return tenantSpecific;

    if (tid !== 'default') {
      const defaultSetting = this.settings.get(this.key(key, 'default'));
      if (defaultSetting) return defaultSetting;
    }
    return null;
  }

  async getAll(tenantId?: string): Promise<ConfigSetting[]> {
    const tid = tenantId || 'default';
    const result = new Map<string, ConfigSetting>();

    for (const s of this.settings.values()) {
      if (s.tenantId === 'default') {
        result.set(s.key, s);
      }
    }

    if (tid !== 'default') {
      for (const s of this.settings.values()) {
        if (s.tenantId === tid) {
          result.set(s.key, s);
        }
      }
    }
    return Array.from(result.values());
  }

  async save(setting: ConfigSetting): Promise<void> {
    this.settings.set(this.key(setting.key, setting.tenantId), setting);
  }

  async delete(key: string, tenantId?: string): Promise<boolean> {
    return this.settings.delete(this.key(key, tenantId));
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

function createToken(role = 'ADMIN', tenantId = 'tenant-alpha'): string {
  const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  return jwt.sign(
    { sub: 'usr-admin-1', role, tenantId, email: 'admin@alpha.io' },
    secret,
    { expiresIn: '1h' }
  );
}

test('Config Service: Back-office CRUD & Security Operations', async (t) => {
  const repo = new InMemoryConfigRepo();
  const { app } = createApp(repo);
  const adminToken = createToken('ADMIN', 'tenant-alpha');
  const userToken = createToken('USER', 'tenant-alpha');

  // Pre-seed default configuration
  await repo.save(
    ConfigSetting.create('PAYMENT_GATEWAY', {
      value: 'stripe',
      description: 'Default payment provider',
      isEncrypted: false,
      tenantId: 'default'
    })
  );

  await t.test('1. Security: Unauthenticated request is rejected with 401', async () => {
    const res = await makeHttpRequest(app, 'GET', '/api/v1/config');
    assert.strictEqual(res.status, 401);
  });

  await t.test('2. RBAC: Non-admin user cannot mutate configuration (403 Forbidden)', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/config',
      { key: 'MAX_RETRIES', value: '5' },
      { authorization: `Bearer ${userToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 403);
  });

  await t.test('3. Create Config: POST /api/v1/config creates setting with ADMIN role', async () => {
    const res = await makeHttpRequest(
      app,
      'POST',
      '/api/v1/config',
      {
        key: 'FEATURE_BETA_DASHBOARD',
        value: 'true',
        description: 'Enables beta analytics dashboard',
        isEncrypted: false
      },
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.key, 'FEATURE_BETA_DASHBOARD');
    assert.strictEqual(res.body.data.value, 'true');
  });

  await t.test('4. List Configs: GET /api/v1/config returns scoped list with pagination meta', async () => {
    const res = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((c: any) => c.key === 'FEATURE_BETA_DASHBOARD'));
    assert.ok(res.body.data.some((c: any) => c.key === 'PAYMENT_GATEWAY')); // Inherited default
    assert.ok(res.body.meta_data?.pagination?.total >= 2);
  });

  await t.test('5. Get Config: GET /api/v1/config/:key retrieves setting by key', async () => {
    const res = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.key, 'FEATURE_BETA_DASHBOARD');
    assert.strictEqual(res.body.data.value, 'true');
  });

  await t.test('6. Update Config: PUT /api/v1/config/:key updates setting value', async () => {
    const res = await makeHttpRequest(
      app,
      'PUT',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      {
        key: 'FEATURE_BETA_DASHBOARD',
        value: 'false',
        description: 'Disabled beta analytics'
      },
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.value, 'false');

    // Verify retrieval reflects update
    const verify = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(verify.body.data.value, 'false');
  });

  await t.test('7. Multi-Tenant Isolation: Tenant Beta cannot see Tenant Alpha custom settings', async () => {
    const betaToken = createToken('ADMIN', 'tenant-beta');

    const res = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      undefined,
      { authorization: `Bearer ${betaToken}`, 'x-tenant-id': 'tenant-beta' }
    );
    // Tenant Beta did not define FEATURE_BETA_DASHBOARD and no default exists
    assert.strictEqual(res.status, 404);

    // Tenant Beta can still read system defaults
    const defaultRes = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config/PAYMENT_GATEWAY',
      undefined,
      { authorization: `Bearer ${betaToken}`, 'x-tenant-id': 'tenant-beta' }
    );
    assert.strictEqual(defaultRes.status, 200);
    assert.strictEqual(defaultRes.body.data.value, 'stripe');
  });

  await t.test('8. Delete Config: DELETE /api/v1/config/:key deletes configuration', async () => {
    const res = await makeHttpRequest(
      app,
      'DELETE',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.deleted, true);

    // Ensure it is now gone
    const verify = await makeHttpRequest(
      app,
      'GET',
      '/api/v1/config/FEATURE_BETA_DASHBOARD',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(verify.status, 404);
  });

  await t.test('9. Route Aliases: Works under /api/config as well', async () => {
    const res = await makeHttpRequest(
      app,
      'GET',
      '/api/config/PAYMENT_GATEWAY',
      undefined,
      { authorization: `Bearer ${adminToken}`, 'x-tenant-id': 'tenant-alpha' }
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, true);
    assert.strictEqual(res.body.data.key, 'PAYMENT_GATEWAY');
  });
});
