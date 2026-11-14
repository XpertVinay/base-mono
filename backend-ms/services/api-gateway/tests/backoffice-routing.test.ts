import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { ServiceKey, GRPC_SERVICE_DEFINITIONS } from '../src/grpc/grpc-gateway.client.js';

function invokeGateway(
  app: Express,
  method: string,
  urlPath: string,
  options: { headers?: Record<string, string>; body?: any } = {}
): Promise<{ status: number; headers: Record<string, any>; json: any; text: string }> {
  return new Promise((resolve, reject) => {
    const socket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) {
        cb();
      }
    }) as any;
    socket.remoteAddress = '127.0.0.1';
    socket.encrypted = false;

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = urlPath;

    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(options.headers || {})) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined;
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
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return origWrite(chunk, ...args);
    }) as any;

    res.end = ((chunk?: any, ...args: any[]) => {
      if (chunk && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      const headerSep = raw.indexOf('\r\n\r\n');
      const bodyPart = headerSep >= 0 && raw.startsWith('HTTP/') ? raw.slice(headerSep + 4) : raw;
      let parsedBody: any = null;
      try {
        parsedBody = bodyPart ? JSON.parse(bodyPart) : null;
      } catch {
        parsedBody = bodyPart;
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        json: parsedBody,
        text: bodyPart
      });
      return origEnd(chunk, ...args);
    }) as any;

    res.on('error', reject);
    (app as any)(req, res);

    if (bodyStr !== undefined) {
      req.push(Buffer.from(bodyStr));
    }
    req.push(null);
  });
}

test('Feature F11 & F14: API Gateway Dual-Plane Back-Office Routing & Perimeter Guard', async (t) => {
  const jwtSecret = 'dev-jwt-super-secret-key-for-iam-service-32-chars';
  const internalSecret = 'dev-internal-service-secret-token-32-chars';

  const userToken = jwt.sign(
    { sub: 'usr-1', email: 'user@example.com', role: 'USER', tenantId: 'default' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { sub: 'adm-1', email: 'admin@example.com', role: 'ADMIN', tenantId: 'default' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const superAdminToken = jwt.sign(
    { sub: 'sadm-1', email: 'super@example.com', role: 'SUPER_ADMIN', tenantId: 'default' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const supportToken = jwt.sign(
    { sub: 'sup-1', email: 'support@example.com', role: 'SUPPORT', tenantId: 'default' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const orgAdminToken = jwt.sign(
    { sub: 'orgadm-1', email: 'orgadmin@example.com', role: 'ORGANIZATION_ADMIN', tenantId: 'default' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const dispatchedRequests: Array<{ serviceKey: ServiceKey; path: string; metadata: Record<string, string> }> = [];

  const mockGrpcManager = {
    getTarget: (key: ServiceKey) => `localhost:5005${Object.keys(GRPC_SERVICE_DEFINITIONS).indexOf(key) + 1}`,
    getServiceMap: () => ({ iam: 'localhost:50051', orders: 'localhost:50056' }),
    dispatch: async (serviceKey: ServiceKey, dispatchReq: any, metadata: Record<string, string>) => {
      dispatchedRequests.push({ serviceKey, path: dispatchReq.path, metadata });
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(
          JSON.stringify({
            status: true,
            success: true,
            message: `Handled by mock ${serviceKey}`,
            data: { service: serviceKey, path: dispatchReq.path }
          }),
          'utf8'
        )
      };
    },
    verifyToken: async () => ({ valid: true, role: 'ADMIN' }),
    closeAll: () => {}
  };

  const { app } = createApp({ grpcClientManager: mockGrpcManager as any });

  await t.test('1. API Directory (F14): GET /api/v1 exposes backoffice services catalog', async () => {
    const res = await invokeGateway(app, 'GET', '/api/v1');
    assert.equal(res.status, 200);
    assert.equal(res.json.status, true);
    assert.ok(res.json.data.backoffice, 'Expected backoffice in GET /api/v1 data');
    assert.equal(res.json.data.backoffice.base, '/api/v1/backoffice');
    assert.equal(res.json.data.backoffice.services.iam, '/api/v1/backoffice/iam');
    assert.equal(res.json.data.backoffice.services.orders, '/api/v1/backoffice/orders');
    assert.equal(res.json.data.backoffice.services.inventory, '/api/v1/backoffice/inventory');
    assert.equal(res.json.data.backoffice.services.transactions, '/api/v1/backoffice/transactions');
    assert.equal(res.json.data.backoffice.services.assets, '/api/v1/backoffice/assets');
    assert.equal(res.json.data.backoffice.services.audit, '/api/v1/backoffice/audit');
    assert.equal(res.json.data.backoffice.services.config, '/api/v1/backoffice/config');
    assert.equal(res.json.data.backoffice.services.organizations, '/api/v1/backoffice/organizations');
    assert.equal(res.json.data.backoffice.services.rbac, '/api/v1/backoffice/rbac');
    assert.equal(res.json.data.backoffice.services.scheduler, '/api/v1/backoffice/scheduler');
    assert.equal(res.json.data.backoffice.services.search, '/api/v1/backoffice/search');
    assert.equal(res.json.data.backoffice.services.notifications, '/api/v1/backoffice/notifications');
    assert.equal(res.json.data.backoffice.services.ai, '/api/v1/backoffice/ai');
  });

  await t.test('2. Perimeter Guard (F11): Rejects unauthenticated requests with HTTP 401 UNAUTHENTICATED', async () => {
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders');
    assert.equal(res.status, 401);
    assert.equal(res.json.success, false);
    assert.equal(res.json.status, false);
    assert.equal(res.json.error.code, 'UNAUTHENTICATED');
    assert.equal(res.json.error.message, 'Authentication token required for back-office access');
  });

  await t.test('3. Perimeter Guard (F11): Rejects standard USER role with HTTP 403 FORBIDDEN', async () => {
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 403);
    assert.equal(res.json.success, false);
    assert.equal(res.json.status, false);
    assert.equal(res.json.error.code, 'FORBIDDEN');
    assert.equal(res.json.error.message, 'Access denied: Back-office operations require administrative privileges');
  });

  await t.test('4. Perimeter Guard (F11): Allows ADMIN role through to downstream service', async () => {
    dispatchedRequests.length = 0;
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(dispatchedRequests.length, 1);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
    assert.equal(dispatchedRequests[0].path, '/api/v1/backoffice/orders');
  });

  await t.test('5. Perimeter Guard (F11): Allows SUPER_ADMIN role through', async () => {
    dispatchedRequests.length = 0;
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { authorization: `Bearer ${superAdminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(dispatchedRequests.length, 1);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
  });

  await t.test('6. Perimeter Guard (F11): Allows SUPPORT role through', async () => {
    dispatchedRequests.length = 0;
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { authorization: `Bearer ${supportToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(dispatchedRequests.length, 1);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
  });

  await t.test('7. Perimeter Guard (F11): Allows ORGANIZATION_ADMIN role through', async () => {
    dispatchedRequests.length = 0;
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { authorization: `Bearer ${orgAdminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(dispatchedRequests.length, 1);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
  });

  await t.test('8. Perimeter Guard (F11): Bypasses auth check with valid x-internal-secret', async () => {
    dispatchedRequests.length = 0;
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice/orders', {
      headers: { 'x-internal-secret': internalSecret }
    });
    assert.equal(res.status, 200);
    assert.equal(dispatchedRequests.length, 1);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
  });

  await t.test('9. Back-Office Discovery: GET /api/v1/backoffice returns 200 directory for authenticated admin', async () => {
    const res = await invokeGateway(app, 'GET', '/api/v1/backoffice', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.status, true);
    assert.equal(res.json.data.plane, 'backoffice');
    assert.equal(res.json.data.services.iam, '/api/v1/backoffice/iam');
    assert.equal(res.json.data.services.ai, '/api/v1/backoffice/ai');
  });

  await t.test('10. Downstream Dispatch (F11): Verifies route dispatch across all 13 backoffice service mappings', async () => {
    const checks: Array<{ path: string; expectedService: ServiceKey }> = [
      { path: '/api/v1/backoffice/iam/users', expectedService: 'iam' },
      { path: '/api/v1/backoffice/users', expectedService: 'iam' },
      { path: '/api/v1/backoffice/roles', expectedService: 'iam' },
      { path: '/api/v1/backoffice/orders', expectedService: 'orders' },
      { path: '/api/v1/backoffice/inventory', expectedService: 'inventory' },
      { path: '/api/v1/backoffice/items', expectedService: 'inventory' },
      { path: '/api/v1/backoffice/transactions', expectedService: 'transactions' },
      { path: '/api/v1/backoffice/assets', expectedService: 'assets' },
      { path: '/api/v1/backoffice/audit', expectedService: 'audit' },
      { path: '/api/v1/backoffice/config', expectedService: 'config' },
      { path: '/api/v1/backoffice/organizations', expectedService: 'organizations' },
      { path: '/api/v1/backoffice/rbac', expectedService: 'rbac' },
      { path: '/api/v1/backoffice/scheduler', expectedService: 'scheduler' },
      { path: '/api/v1/backoffice/jobs', expectedService: 'scheduler' },
      { path: '/api/v1/backoffice/search', expectedService: 'search' },
      { path: '/api/v1/backoffice/notifications', expectedService: 'notifications' },
      { path: '/api/v1/backoffice/ai', expectedService: 'ai' }
    ];

    for (const check of checks) {
      dispatchedRequests.length = 0;
      const res = await invokeGateway(app, 'GET', check.path, {
        headers: { authorization: `Bearer ${adminToken}` }
      });
      assert.equal(res.status, 200, `Expected 200 for ${check.path}, got ${res.status}`);
      assert.equal(dispatchedRequests.length, 1);
      assert.equal(
        dispatchedRequests[0].serviceKey,
        check.expectedService,
        `Expected ${check.path} to route to ${check.expectedService}, got ${dispatchedRequests[0].serviceKey}`
      );
    }
  });

  await t.test('11. Unversioned Aliases: /api/backoffice/orders enforces perimeter guard and dispatches', async () => {
    // 401 unauth
    const unauth = await invokeGateway(app, 'GET', '/api/backoffice/orders');
    assert.equal(unauth.status, 401);

    // 403 non-admin
    const forbidden = await invokeGateway(app, 'GET', '/api/backoffice/orders', {
      headers: { authorization: `Bearer ${userToken}` }
    });
    assert.equal(forbidden.status, 403);

    // 200 admin
    dispatchedRequests.length = 0;
    const ok = await invokeGateway(app, 'GET', '/api/backoffice/orders', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(ok.status, 200);
    assert.equal(dispatchedRequests[0].serviceKey, 'orders');
  });

  await t.test('12. Swagger Back-Office Documentation: exposes dedicated /api-docs/backoffice.json spec and swagger redirects', async () => {
    const res = await invokeGateway(app, 'GET', '/api-docs/backoffice.json');
    assert.equal(res.status, 200);
    assert.equal(res.json.info.title, 'Enterprise Microservices Platform - Back-Office REST API');
    assert.ok(res.json.paths['/api/v1/backoffice']);
    assert.ok(res.json.paths['/api/v1/backoffice/config']);
    assert.ok(res.json.paths['/api/v1/backoffice/orders']);
    assert.ok(res.json.paths['/api/v1/backoffice/inventory/items']);

    const restRes = await invokeGateway(app, 'GET', '/api-docs/rest.json');
    assert.equal(restRes.status, 200);
    assert.ok(restRes.json.paths['/api/v1/backoffice']);
    assert.ok(restRes.json.paths['/api/v1/backoffice/orders']);
  });
});
