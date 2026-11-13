import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { invokeExpressApp } from '../src/grpc/express-grpc-bridge.js';

test('Audit logs telemetry enforces security keys, blocks unauthenticated access with 401, throttles DDoS with 429, and blocks unauthorized remediations', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevRateLimit = process.env.AUDIT_READ_RATE_LIMIT_MAX;
  const internalSecret = 'dev-internal-service-secret-token-32-chars';

  process.env.NODE_ENV = 'production';
  process.env.AUDIT_READ_RATE_LIMIT_MAX = '3';
  process.env.INTERNAL_SERVICE_SECRET = internalSecret;

  try {
    const { app, recordUseCase, queryUseCase } = createApp();
    const recordedEvents: any[] = [];
    const origExecute = recordUseCase.execute.bind(recordUseCase);
    recordUseCase.execute = async (input) => {
      recordedEvents.push(input);
      return origExecute(input).catch(() => ({
        isSuccess: true,
        isFailure: false,
        getValue: () => ({
          id: 'test-id',
          ...input,
          severity: input.severity || 'INFO',
          createdAt: new Date().toISOString()
        })
      }) as any);
    };
    queryUseCase.execute = async () => ({
      isSuccess: true,
      isFailure: false,
      getValue: () => []
    }) as any;

    // 1. Unauthenticated access to GET /logs is rejected with 401
    const unauthRes = await invokeExpressApp(app, {
      method: 'GET',
      path: '/api/v1/audit/logs?limit=50',
      clientIp: '203.0.113.88'
    });
    assert.equal(unauthRes.statusCode, 401, 'Unauthenticated GET /logs must be rejected with 401');

    // 2. First 3 requests with valid backend service key succeed with 200
    for (let i = 0; i < 3; i++) {
      const res = await invokeExpressApp(app, {
        method: 'GET',
        path: '/api/v1/audit/logs?limit=50',
        headers: { 'x-internal-secret': internalSecret },
        clientIp: '203.0.113.77'
      });
      assert.equal(res.statusCode, 200, 'GET /logs with backend key should succeed with 200');
    }

    // 3. 4th request triggers DDoS rate limiter (429) and reports attack to audit monitor
    const blocked = await invokeExpressApp(app, {
      method: 'GET',
      path: '/api/v1/audit/logs?limit=50',
      headers: { 'x-internal-secret': internalSecret },
      clientIp: '203.0.113.77'
    });
    assert.equal(blocked.statusCode, 429);
    const blockedJson = JSON.parse(blocked.body.toString('utf8'));
    assert.equal(blockedJson.error.code, 'RATE_LIMIT_EXCEEDED');

    // Allow async fire-and-forget audit persistence + monitoring broadcast promise to settle
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(
      recordedEvents.some(
        (ev) => ev.action === 'DDOS_RATE_LIMIT_BREACH' && ev.severity === 'CRITICAL'
      ),
      'DDoS breach should be automatically reported to audit monitoring'
    );

    // 4. Verify remediation endpoint blocks regular users even with x-user-id header
    const remUserBlocked = await invokeExpressApp(app, {
      method: 'POST',
      path: '/api/v1/audit/remediate',
      headers: {
        'content-type': 'application/json',
        'x-user-id': 'user-123',
        'x-user-role': 'USER'
      },
      body: Buffer.from(JSON.stringify({ actionType: 'FLUSH_CACHE', targetResource: 'redis' })),
      clientIp: '198.51.100.99'
    });
    assert.equal(remUserBlocked.statusCode, 401, 'Regular user cannot bypass remediation admin check with x-user-id');

  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.AUDIT_READ_RATE_LIMIT_MAX = prevRateLimit;
  }
});
