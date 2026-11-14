import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimiter, RateLimitViolationInfo } from '../src/shared/presentation/rate-limiter.middleware.js';
import type { Request, Response, NextFunction } from 'express';

function createMockReqRes(options?: {
  ip?: string;
  user?: { id: string; tenantId: string };
  headers?: Record<string, string>;
}) {
  const req: any = {
    ip: options?.ip || '127.0.0.1',
    socket: { remoteAddress: options?.ip || '127.0.0.1' },
    user: options?.user,
    headers: options?.headers || {},
    header: (name: string) => options?.headers?.[name.toLowerCase()]
  };

  const headersSent: Record<string, any> = {};
  let statusCode = 200;
  let jsonResponse: any = null;

  const res: any = {
    setHeader: (name: string, value: any) => {
      headersSent[name.toLowerCase()] = value;
    },
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (body: any) => {
      jsonResponse = body;
      return res;
    }
  };

  return {
    req: req as Request,
    res: res as Response,
    getHeaders: () => headersSent,
    getStatusCode: () => statusCode,
    getJson: () => jsonResponse
  };
}

test('Rate Limiter Middleware: Standardized Behavior & Memory Boundedness', async (t) => {
  await t.test('Unauthenticated requests are keyed by IP and attach rate limit headers', () => {
    const limiter = rateLimiter({ max: 5, windowMs: 60000 });
    let nextCalled = false;
    const { req, res, getHeaders, getStatusCode } = createMockReqRes({ ip: '198.51.100.1' });

    limiter(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(getStatusCode(), 200);
    const headers = getHeaders();
    assert.equal(headers['x-ratelimit-limit'], 5);
    assert.equal(headers['x-ratelimit-remaining'], 4);
    assert.ok(headers['x-ratelimit-reset'] > 0);
  });

  await t.test('Authenticated requests are keyed by ${tenantId}:${userId}', () => {
    const limiter = rateLimiter({ max: 2, windowMs: 60000 });

    // Request from User 1 on IP 10.0.0.1
    const user1Req = createMockReqRes({
      ip: '10.0.0.1',
      user: { id: 'user-1', tenantId: 'tenant-alpha' }
    });
    limiter(user1Req.req, user1Req.res, () => {});
    assert.equal(user1Req.getHeaders()['x-ratelimit-remaining'], 1);

    // Request from User 2 on SAME IP 10.0.0.1 (e.g. corporate proxy)
    const user2Req = createMockReqRes({
      ip: '10.0.0.1',
      user: { id: 'user-2', tenantId: 'tenant-alpha' }
    });
    limiter(user2Req.req, user2Req.res, () => {});
    // User 2 should have their own limit counter (remaining: 1, not 0)
    assert.equal(user2Req.getHeaders()['x-ratelimit-remaining'], 1);

    // Second request from User 1 -> remaining: 0
    const user1Req2 = createMockReqRes({
      ip: '10.0.0.1',
      user: { id: 'user-1', tenantId: 'tenant-alpha' }
    });
    limiter(user1Req2.req, user1Req2.res, () => {});
    assert.equal(user1Req2.getHeaders()['x-ratelimit-remaining'], 0);

    // Third request from User 1 -> 429 RATE_LIMIT_EXCEEDED with Retry-After header
    const user1Req3 = createMockReqRes({
      ip: '10.0.0.1',
      user: { id: 'user-1', tenantId: 'tenant-alpha' }
    });
    let nextCalledOnThird = false;
    limiter(user1Req3.req, user1Req3.res, () => {
      nextCalledOnThird = true;
    });
    assert.equal(nextCalledOnThird, false);
    assert.equal(user1Req3.getStatusCode(), 429);
    assert.equal(user1Req3.getJson()?.error?.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(user1Req3.getHeaders()['retry-after'] >= 1);
  });

  await t.test('Bounded capacity eviction: prevents memory exhaustion when maxEntries reached', () => {
    const violations: RateLimitViolationInfo[] = [];
    const limiter = rateLimiter({
      max: 10,
      windowMs: 60000,
      maxEntries: 3,
      onLimitExceeded: (_req, info) => violations.push(info)
    });

    // Populate 3 entries (keys: ip-1, ip-2, ip-3)
    for (let i = 1; i <= 3; i++) {
      const mock = createMockReqRes({ ip: `10.0.0.${i}` });
      limiter(mock.req, mock.res, () => {});
    }

    // Insert 4th key -> capacity guard evicts oldest key (ip-1)
    const mock4 = createMockReqRes({ ip: '10.0.0.4' });
    limiter(mock4.req, mock4.res, () => {});
    assert.equal(mock4.getHeaders()['x-ratelimit-remaining'], 9);

    // Re-accessing ip-1 now gets a fresh counter (remaining: 9 instead of 8)
    const mock1Again = createMockReqRes({ ip: '10.0.0.1' });
    limiter(mock1Again.req, mock1Again.res, () => {});
    assert.equal(mock1Again.getHeaders()['x-ratelimit-remaining'], 9);
  });

  await t.test('Telemetry callback triggered on limit breach', () => {
    let violationReported: RateLimitViolationInfo | null = null;
    const limiter = rateLimiter({
      max: 1,
      windowMs: 60000,
      onLimitExceeded: (_req, info) => {
        violationReported = info;
      }
    });

    const m1 = createMockReqRes({ ip: '192.0.2.1' });
    limiter(m1.req, m1.res, () => {});

    const m2 = createMockReqRes({ ip: '192.0.2.1' });
    limiter(m2.req, m2.res, () => {});

    assert.equal(m2.getStatusCode(), 429);
    assert.ok(violationReported);
    assert.equal(violationReported?.ip, '192.0.2.1');
    assert.equal(violationReported?.count, 2);
    assert.equal(violationReported?.firstViolationInWindow, true);
  });
});
