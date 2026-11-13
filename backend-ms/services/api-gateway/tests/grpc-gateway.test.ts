import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Duplex } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Express } from 'express';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { GRPC_SERVICE_DEFINITIONS, ServiceKey } from '../src/grpc/grpc-gateway.client.js';
import { invokeExpressApp } from '../../iam-service/src/grpc/express-grpc-bridge.js';
import { createApp as createIamApp } from '../../iam-service/src/app.js';
import { startIamGrpcServer } from '../../iam-service/src/grpc/iam.grpc-server.js';
import { createApp as createAssetApp } from '../../asset-service/src/app.js';
import { startAssetGrpcServer } from '../../asset-service/src/grpc/asset.grpc-server.js';
import { createApp as createConfigApp } from '../../config-service/src/app.js';
import { startConfigGrpcServer } from '../../config-service/src/grpc/config.grpc-server.js';
import { createApp as createNotificationApp } from '../../notification-service/src/app.js';
import { startNotificationGrpcServer } from '../../notification-service/src/grpc/notification.grpc-server.js';
import { createApp as createSchedulerApp } from '../../scheduler-service/src/app.js';
import { startSchedulerGrpcServer } from '../../scheduler-service/src/grpc/scheduler.grpc-server.js';
import { createApp as createOrderApp } from '../../order-service/src/app.js';
import { startOrderGrpcServer } from '../../order-service/src/grpc/order.grpc-server.js';
import { createApp as createTransactionApp } from '../../transaction-service/src/app.js';
import { startTransactionGrpcServer } from '../../transaction-service/src/grpc/transaction.grpc-server.js';
import { createApp as createSearchApp } from '../../search-service/src/app.js';
import { startSearchGrpcServer } from '../../search-service/src/grpc/search.grpc-server.js';
import { createApp as createInventoryApp } from '../../inventory-service/src/app.js';
import { startInventoryGrpcServer } from '../../inventory-service/src/grpc/inventory.grpc-server.js';
import { createApp as createAiApp } from '../../ai-service/src/app.js';
import { startAiGrpcServer } from '../../ai-service/src/grpc/ai.grpc-server.js';
import { createApp as createAuditApp } from '../../audit-service/src/app.js';
import { startAuditGrpcServer } from '../../audit-service/src/grpc/audit.grpc-server.js';
import { createApp as createOrganizationApp } from '../../organization-service/src/app.js';
import { startOrganizationGrpcServer } from '../../organization-service/src/grpc/organization.grpc-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROTO_DIR = path.resolve(__dirname, '../src/proto');

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

async function startMockGrpcBackend(
  key: ServiceKey
): Promise<{ server: grpc.Server; target: string }> {
  const def = GRPC_SERVICE_DEFINITIONS[key];
  const protoPath = path.join(PROTO_DIR, def.protoFile);
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  const descriptor = grpc.loadPackageDefinition(packageDef) as any;
  const serviceDef = descriptor[def.packageName][def.grpcServiceName].service;

  const miniApp = express();
  miniApp.use(express.json());
  miniApp.all('*', (req, res) => {
    res.status(200).json({
      status: true,
      service: def.serviceName,
      method: req.method,
      path: req.originalUrl,
      body: req.body,
      propagatedHeaders: {
        userId: req.header('x-user-id') || null,
        userRole: req.header('x-user-role') || null,
        tenantId: req.header('x-tenant-id') || null,
        internalSecret: req.header('x-internal-secret') || null,
        gatewayProtocol: req.header('x-gateway-protocol') || null,
        correlationId: req.header('x-correlation-id') || null
      }
    });
  });

  const server = new grpc.Server();
  const handlers: Record<string, any> = {};

  for (const methodName of Object.keys(serviceDef)) {
    if (methodName === 'HealthCheck') {
      handlers[methodName] = (_call: any, callback: any) => {
        callback(null, {
          status: true,
          service: def.serviceName,
          version: 'v1',
          timestamp: new Date().toISOString(),
          uptimeSeconds: 1
        });
      };
    } else if (methodName === 'Dispatch') {
      handlers[methodName] = async (call: any, callback: any) => {
        const result = await invokeExpressApp(miniApp, call.request);
        callback(null, result);
      };
    } else if (methodName === 'VerifyToken') {
      handlers[methodName] = (call: any, callback: any) => {
        callback(null, {
          status: true,
          message: 'Verified',
          errors: [],
          valid: true,
          userId: 'grpc-verified-user',
          email: 'grpc@example.com',
          role: 'ADMIN',
          tenantId: call.request.expectedTenantId || 'default',
          data: {
            valid: true,
            userId: 'grpc-verified-user',
            email: 'grpc@example.com',
            role: 'ADMIN',
            tenantId: call.request.expectedTenantId || 'default',
            tenantSlug: 'default',
            authMethod: 'LOCAL',
            provider: ''
          }
        });
      };
    } else {
      handlers[methodName] = (_call: any, callback: any) => {
        callback(null, { status: true, message: 'OK', errors: [] });
      };
    }
  }

  server.addService(serviceDef, handlers);

  const boundPort = await new Promise<number>((resolve, reject) => {
    server.bindAsync(
      '127.0.0.1:0',
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        resolve(port);
      }
    );
  });

  return { server, target: `127.0.0.1:${boundPort}` };
}

test('API Gateway routes all 11 services over gRPC HTTP/2 and aggregates gRPC health checks', async () => {
  const servers: grpc.Server[] = [];
  const grpcTargets = {} as Record<ServiceKey, string>;

  for (const key of Object.keys(GRPC_SERVICE_DEFINITIONS) as ServiceKey[]) {
    const started = await startMockGrpcBackend(key);
    servers.push(started.server);
    grpcTargets[key] = started.target;
  }

  const { app, grpcManager } = createApp({ grpcTargets });

  try {
    // 1. Directory endpoint reports gRPC+HTTP/2 transport and all 12 mappings
    const directoryRes = await invokeGateway(app, 'GET', '/api/v1');
    assert.equal(directoryRes.status, 200);
    assert.equal(directoryRes.json.data.upstreamProtocol, 'grpc+http2');
    assert.equal(Object.keys(directoryRes.json.data.grpcMapping).length, 12);

    // 2. Aggregated detailed health check queries all 10 services over gRPC
    const healthRes = await invokeGateway(app, 'GET', '/api/v1/health/detailed');
    assert.equal(healthRes.status, 200, `Health failed: ${JSON.stringify(healthRes.json)}`);
    assert.equal(healthRes.json.data.transport, 'grpc+http2');
    for (const key of Object.keys(GRPC_SERVICE_DEFINITIONS) as ServiceKey[]) {
      assert.equal(healthRes.json.data.services[key].status, 'UP');
      assert.equal(healthRes.json.data.services[key].protocol, 'grpc');
    }

    // 3. JWT auth + header spoofing prevention + gRPC dispatch to ALL 10 services
    const jwtSecret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
    const token = jwt.sign(
      { sub: 'user-123', email: 'alice@example.com', role: 'ADMIN', tenantId: 'tenant-alpha' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const routeChecks: Array<{ key: ServiceKey; method: string; path: string; body?: any }> = [
      { key: 'iam', method: 'GET', path: '/api/v1/iam/profile' },
      { key: 'assets', method: 'POST', path: '/api/v1/assets', body: { name: 'doc.pdf' } },
      { key: 'config', method: 'GET', path: '/api/v1/config/ACTIVE_PAYMENT_GATEWAY' },
      { key: 'notifications', method: 'POST', path: '/api/v1/notifications', body: { recipient: 'a@b.com' } },
      { key: 'scheduler', method: 'GET', path: '/api/v1/scheduler/jobs' },
      { key: 'orders', method: 'POST', path: '/api/v1/orders', body: { items: [{ productId: 'p1', quantity: 1 }] } },
      { key: 'transactions', method: 'POST', path: '/api/v1/transactions/initiate', body: { amount: 99 } },
      { key: 'search', method: 'GET', path: '/api/v1/search?q=laptop' },
      { key: 'inventory', method: 'GET', path: '/api/v1/inventory/prod-1' },
      { key: 'ai', method: 'GET', path: '/api/v1/ai/capabilities' },
      { key: 'audit', method: 'GET', path: '/api/v1/audit/logs?limit=10' }
    ];

    for (const check of routeChecks) {
      const def = GRPC_SERVICE_DEFINITIONS[check.key];
      const res = await invokeGateway(app, check.method, check.path, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-correlation-id': `corr-${check.key}`,
          // Attempt spoofing — gateway must strip and replace with verified claims
          'x-user-id': 'spoofed-user',
          'x-internal-secret': 'wrong-secret'
        },
        body: check.body
      });

      assert.equal(res.status, 200, `Expected 200 for ${check.key}, got ${res.status}: ${res.text}`);
      assert.equal(res.headers['x-gateway-upstream'], `${def.serviceName}:grpc`);
      assert.equal(res.json.service, def.serviceName);
      assert.equal(res.json.path, check.path);
      assert.equal(res.json.propagatedHeaders.userId, 'user-123');
      assert.equal(res.json.propagatedHeaders.userRole, 'ADMIN');
      assert.equal(res.json.propagatedHeaders.tenantId, 'tenant-alpha');
      assert.equal(res.json.propagatedHeaders.gatewayProtocol, 'grpc');
      assert.equal(res.json.propagatedHeaders.correlationId, `corr-${check.key}`);
      assert.equal(
        res.json.propagatedHeaders.internalSecret,
        process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars'
      );
      if (check.body) {
        assert.deepEqual(res.json.body, check.body);
      }
    }

    // 4. Tenant mismatch is blocked at gateway edge before gRPC dispatch
    const mismatchRes = await invokeGateway(app, 'GET', '/api/v1/orders/my', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'tenant-other'
      }
    });
    assert.equal(mismatchRes.status, 403);
    assert.equal(mismatchRes.json.error.code, 'TENANT_MISMATCH');

    // 5. Unversioned /api/<service> alias also dispatches over gRPC
    const aliasRes = await invokeGateway(app, 'GET', '/api/search?q=test');
    assert.equal(aliasRes.status, 200);
    assert.equal(aliasRes.json.service, 'search-service');
    assert.equal(aliasRes.headers['x-gateway-upstream'], 'search-service:grpc');

    // 6. Unavailable downstream gRPC server returns 502 BAD_GATEWAY and 503 on detailed health
    servers[0].forceShutdown();
    const unavailableRes = await invokeGateway(app, 'GET', '/api/v1/iam/profile');
    assert.equal(unavailableRes.status, 502);
    assert.equal(unavailableRes.json.errors[0].code, 'BAD_GATEWAY');
  } finally {
    grpcManager.closeAll();
    for (const s of servers) {
      s.forceShutdown();
    }
  }
});

test('Real gRPC servers for all 11 microservices connect through API Gateway', async () => {
  const iam = createIamApp();
  const asset = createAssetApp();
  const config = createConfigApp();
  const notification = createNotificationApp();
  const scheduler = createSchedulerApp();
  const order = createOrderApp();
  const transaction = createTransactionApp();
  const search = createSearchApp();
  const inventory = createInventoryApp();
  const ai = createAiApp({ useInMemoryStore: true });
  const audit = createAuditApp();
  const organization = createOrganizationApp();

  const basePort = 56151;
  const servers: grpc.Server[] = [
    startIamGrpcServer(iam.userRepo, basePort, iam.tenantRepo, iam.app),
    startAssetGrpcServer(asset.createUseCase, asset.listQuery, basePort + 1, asset.app),
    startConfigGrpcServer(config.repo, basePort + 2, config.app),
    startNotificationGrpcServer(notification.sendUseCase, notification.listQuery, basePort + 3, notification.app),
    startSchedulerGrpcServer(scheduler.listQuery, scheduler.createUseCase, scheduler.triggerUseCase, basePort + 4, scheduler.app),
    startOrderGrpcServer(
      {
        createUseCase: order.createUseCase,
        cancelUseCase: order.cancelUseCase,
        getByIdQuery: order.getByIdQuery,
        listMyQuery: order.listMyQuery
      },
      basePort + 5,
      order.app
    ),
    startTransactionGrpcServer(
      {
        initiateUseCase: transaction.initiateUseCase,
        completeUseCase: transaction.completeUseCase,
        getByIdQuery: transaction.getByIdQuery
      },
      basePort + 6,
      transaction.app
    ),
    startSearchGrpcServer(search.searchUseCase, basePort + 7, search.app),
    startInventoryGrpcServer(inventory.repo, basePort + 8, inventory.app),
    startAiGrpcServer(
      {
        listProviders: ai.listProviders,
        registerProvider: ai.registerProvider,
        listTools: ai.listTools,
        callTool: ai.callTool,
        orchestrateTools: ai.orchestrateTools
      },
      basePort + 9,
      ai.app
    ),
    startAuditGrpcServer(audit.recordUseCase, audit.queryUseCase, basePort + 10, audit.app),
    startOrganizationGrpcServer(organization.orgRepo, organization.memberRepo, basePort + 11, organization.app)
  ];

  // Allow async gRPC server binds to settle
  await new Promise((r) => setTimeout(r, 150));

  const { app, grpcManager } = createApp({
    grpcTargets: {
      iam: `127.0.0.1:${basePort}`,
      assets: `127.0.0.1:${basePort + 1}`,
      config: `127.0.0.1:${basePort + 2}`,
      notifications: `127.0.0.1:${basePort + 3}`,
      scheduler: `127.0.0.1:${basePort + 4}`,
      orders: `127.0.0.1:${basePort + 5}`,
      transactions: `127.0.0.1:${basePort + 6}`,
      search: `127.0.0.1:${basePort + 7}`,
      inventory: `127.0.0.1:${basePort + 8}`,
      ai: `127.0.0.1:${basePort + 9}`,
      audit: `127.0.0.1:${basePort + 10}`,
      organizations: `127.0.0.1:${basePort + 11}`
    }
  });

  try {
    // 1. All 11 real gRPC servers report UP via HealthCheck RPC
    const healthRes = await invokeGateway(app, 'GET', '/api/v1/health/detailed');
    assert.equal(healthRes.status, 200, `Real gRPC health failed: ${JSON.stringify(healthRes.json)}`);
    for (const key of Object.keys(GRPC_SERVICE_DEFINITIONS) as ServiceKey[]) {
      assert.equal(healthRes.json.data.services[key].status, 'UP');
      assert.equal(healthRes.json.data.services[key].protocol, 'grpc');
    }

    // 2. Real IAM route through gRPC (no DB needed for tenants/config)
    const iamCfgRes = await invokeGateway(app, 'GET', '/api/v1/iam/tenants/config');
    assert.equal(iamCfgRes.status, 200);
    assert.equal(iamCfgRes.json.status, true);
    assert.equal(iamCfgRes.headers['x-gateway-upstream'], 'iam-service:grpc');

    // 3. Real Audit routes through gRPC (in-memory monitoring config & alerts)
    const auditCfgRes = await invokeGateway(app, 'GET', '/api/v1/audit/config');
    assert.equal(auditCfgRes.status, 200);
    assert.equal(auditCfgRes.json.status, true);
    assert.equal(auditCfgRes.headers['x-gateway-upstream'], 'audit-service:grpc');

    const auditAlertsRes = await invokeGateway(app, 'GET', '/api/v1/audit/alerts');
    assert.equal(auditAlertsRes.status, 200);
    assert.ok(Array.isArray(auditAlertsRes.json.data));

    // 4. Real auth-protected downstream routes validate propagated JWT & RBAC over gRPC
    const unauthAssetRes = await invokeGateway(app, 'GET', '/api/v1/assets/my');
    assert.equal(unauthAssetRes.status, 401);
    assert.equal(unauthAssetRes.headers['x-gateway-upstream'], 'asset-service:grpc');

    const unauthOrderRes = await invokeGateway(app, 'GET', '/api/v1/orders/my');
    assert.equal(unauthOrderRes.status, 401);
    assert.equal(unauthOrderRes.headers['x-gateway-upstream'], 'order-service:grpc');

    const unauthTxnRes = await invokeGateway(app, 'POST', '/api/v1/transactions/initiate', {
      body: { referenceId: 'ord-1', amount: 10 }
    });
    assert.equal(unauthTxnRes.status, 401);
    assert.equal(unauthTxnRes.headers['x-gateway-upstream'], 'transaction-service:grpc');

    const unauthSchedRes = await invokeGateway(app, 'GET', '/api/v1/scheduler/jobs');
    assert.equal(unauthSchedRes.status, 401);
    assert.equal(unauthSchedRes.headers['x-gateway-upstream'], 'scheduler-service:grpc');

    const unauthNotifRes = await invokeGateway(app, 'GET', '/api/v1/notifications');
    assert.equal(unauthNotifRes.status, 401);
    assert.equal(unauthNotifRes.headers['x-gateway-upstream'], 'notification-service:grpc');

    // Trailing slash & unversioned alias for notifications must preserve full path over gRPC
    const unauthNotifTrailingSlashRes = await invokeGateway(app, 'GET', '/api/notifications/');
    assert.equal(unauthNotifTrailingSlashRes.status, 401);
    assert.equal(unauthNotifTrailingSlashRes.headers['x-gateway-upstream'], 'notification-service:grpc');

    const unauthNotifV1TrailingSlashRes = await invokeGateway(app, 'GET', '/api/v1/notifications/');
    assert.equal(unauthNotifV1TrailingSlashRes.status, 401);
    assert.equal(unauthNotifV1TrailingSlashRes.headers['x-gateway-upstream'], 'notification-service:grpc');

    // Non-admin role reaches RBAC check on /api/notifications/ -> 403 FORBIDDEN (not 404)
    const jwtSecret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
    const userToken = jwt.sign(
      { sub: 'user-1', email: 'user@example.com', role: 'USER', tenantId: 'default' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const forbiddenNotifRes = await invokeGateway(app, 'GET', '/api/notifications/', {
      headers: { authorization: `Bearer ${userToken}` }
    });
    assert.equal(forbiddenNotifRes.status, 403);
    assert.equal(forbiddenNotifRes.headers['x-gateway-upstream'], 'notification-service:grpc');

    // 5. Real Zod validation over gRPC for config-service (ADMIN JWT propagated via gateway)
    const adminToken = jwt.sign(
      { sub: 'admin-1', email: 'admin@example.com', role: 'ADMIN', tenantId: 'default' },
      jwtSecret,
      { expiresIn: '1h' }
    );
    const badConfigRes = await invokeGateway(app, 'POST', '/api/v1/config', {
      headers: { authorization: `Bearer ${adminToken}` },
      body: { key: '' }
    });
    assert.equal(badConfigRes.status, 400);
    assert.equal(badConfigRes.headers['x-gateway-upstream'], 'config-service:grpc');

    // 6. Real Zod validation over gRPC for inventory-service
    const badInvRes = await invokeGateway(app, 'POST', '/api/v1/inventory/stock', {
      headers: { authorization: `Bearer ${adminToken}` },
      body: { productId: '', quantity: -5 }
    });
    assert.equal(badInvRes.status, 400);
    assert.equal(badInvRes.headers['x-gateway-upstream'], 'inventory-service:grpc');

    // 7. Real 404 route handling over gRPC for search-service
    const search404Res = await invokeGateway(app, 'GET', '/api/v1/search/nonexistent-subroute');
    assert.equal(search404Res.status, 404);
    assert.equal(search404Res.headers['x-gateway-upstream'], 'search-service:grpc');

    // 8. Real AI & MCP Service capabilities & authenticated tool discovery over gRPC
    const aiCapsRes = await invokeGateway(app, 'GET', '/api/v1/ai/capabilities');
    assert.equal(aiCapsRes.status, 200);
    assert.equal(aiCapsRes.headers['x-gateway-upstream'], 'ai-service:grpc');
    assert.equal(aiCapsRes.json.data.service, 'ai-service');

    const aiToolsRes = await invokeGateway(app, 'GET', '/api/v1/ai/tools', {
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(aiToolsRes.status, 200);
    assert.equal(aiToolsRes.headers['x-gateway-upstream'], 'ai-service:grpc');
    assert.ok(Array.isArray(aiToolsRes.json.data));
    assert.ok(aiToolsRes.json.data.some((t: any) => t.qualifiedName === 'builtin-communication.send_notification'));

    // 9. Real Organization routes over gRPC
    const unauthOrgRes = await invokeGateway(app, 'GET', '/api/v1/organizations');
    assert.equal(unauthOrgRes.status, 401);
    assert.equal(unauthOrgRes.headers['x-gateway-upstream'], 'organization-service:grpc');
  } finally {
    await ai.closeResources();
    grpcManager.closeAll();
    for (const s of servers) {
      s.forceShutdown();
    }
  }
});
