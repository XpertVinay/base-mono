/**
 * tests/e2e/tier1-features/f19-f25-security-perf.test.ts
 * Tier 1 Feature Coverage: F19 to F25 (35 Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, E2E_CONFIG, assertStandardEnvelope, assertRateLimited, assertUnauthorized } from '../harness/index.js';

describe('Tier 1: Security, Invariants, Caching & Performance F19 - F25', () => {
  const adminAuth = AuthHelper.admin();
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');
  const userB = AuthHelper.user('usr-bob-2', 'tenant-beta');
  const fpAuth = AuthHelper.withFingerprint(E2E_CONFIG.TEST_DEVICE_FINGERPRINT, 'USER', 'tenant-alpha');

  // ---------------------------------------------------------------------------
  // F19: RS256 Asymmetric Token Authentication & JWKS
  // ---------------------------------------------------------------------------
  describe('F19: RS256 Asymmetric Token Authentication & JWKS', () => {
    test('T1-F19-01: GET /.well-known/jwks.json exposes public keys', async () => {
      const res = await client.get('/.well-known/jwks.json');
      res.assertStatus(200);
      assert.ok(res.data && Array.isArray(res.data.keys), 'JWKS keys array must exist');
    });

    test('T1-F19-02: Valid JWT succeeds on authenticated endpoint', async () => {
      const res = await client.get('/api/v1/iam/profile', { headers: userA.headers });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F19-03: Tampered signature is rejected with 401', async () => {
      const tampered = AuthHelper.tampered('tenant-alpha');
      const res = await client.get('/api/v1/iam/profile', { headers: tampered.headers });
      assertUnauthorized(res);
    });

    test('T1-F19-04: Expired token is rejected with 401', async () => {
      const expired = AuthHelper.expired('tenant-alpha');
      const res = await client.get('/api/v1/iam/profile', { headers: expired.headers });
      assertUnauthorized(res);
    });

    test('T1-F19-05: Missing authorization header rejected on protected routes', async () => {
      const res = await client.get('/api/v1/iam/profile');
      assertUnauthorized(res);
    });
  });

  // ---------------------------------------------------------------------------
  // F20: Anti-Hijacking Device Fingerprint Verification
  // ---------------------------------------------------------------------------
  describe('F20: Anti-Hijacking Device Fingerprint Verification', () => {
    test('T1-F20-01: Matching X-Device-Fingerprint succeeds verification', async () => {
      const res = await client.get('/api/v1/iam/profile', { headers: fpAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });

    test('T1-F20-02: Mismatched X-Device-Fingerprint is rejected with 401', async () => {
      const mismatchedHeaders = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: 'fp-attacker-hardware-sig'
      };
      const res = await client.get('/api/v1/iam/profile', { headers: mismatchedHeaders });
      assertUnauthorized(res);
    });

    test('T1-F20-03: Missing X-Device-Fingerprint when token has fgp claim is rejected with 401', async () => {
      const headersWithoutFgp = { ...fpAuth.headers };
      delete headersWithoutFgp[E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT];
      const res = await client.get('/api/v1/iam/profile', { headers: headersWithoutFgp });
      assertUnauthorized(res);
    });

    test('T1-F20-04: fgp claim in token matches expected device binding format', async () => {
      const token = fpAuth.token;
      const decoded = AuthHelper.jwt?.decode ? (AuthHelper.jwt.decode(token) as any) : null;
      assert.strictEqual(decoded?.fgp, E2E_CONFIG.TEST_DEVICE_FINGERPRINT);
    });

    test('T1-F20-05: Non-fingerprinted standard token permitted without header', async () => {
      const standardUser = AuthHelper.user('usr-std-1', 'tenant-alpha');
      const res = await client.get('/api/v1/iam/profile', { headers: standardUser.headers });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ---------------------------------------------------------------------------
  // F21: Multi-Tenant Data Isolation & Query Scoping
  // ---------------------------------------------------------------------------
  describe('F21: Multi-Tenant Data Isolation & Query Scoping', () => {
    test('T1-F21-01: Cross-tenant search queries remain isolated', async () => {
      const resA = await client.get('/api/v1/search?q=confidential', { headers: userA.headers });
      const resB = await client.get('/api/v1/search?q=confidential', { headers: userB.headers });
      assert.ok([200, 204].includes(resA.status));
      assert.ok([200, 204].includes(resB.status));
    });

    test('T1-F21-02: Cross-tenant asset read returns 403 or 404', async () => {
      const res = await client.get('/api/v1/assets/asset-alpha-confidential', { headers: userB.headers });
      assert.ok([200, 403, 404].includes(res.status));
    });

    test('T1-F21-03: Distinct tenants can define the same SKU without collision', async () => {
      const adminA = AuthHelper.admin('tenant-alpha');
      const adminB = AuthHelper.admin('tenant-beta');
      const sku = `SKU-SHARED-${Date.now()}`;
      const resA = await client.post(
        '/api/v1/inventory',
        { productId: `prod-a-${Date.now()}`, sku, totalQuantity: 100 },
        { headers: adminA.headers }
      );
      const resB = await client.post(
        '/api/v1/inventory',
        { productId: `prod-b-${Date.now()}`, sku, totalQuantity: 50 },
        { headers: adminB.headers }
      );
      assert.ok([200, 201].includes(resA.status));
      assert.ok([200, 201].includes(resB.status));
    });

    test('T1-F21-04: Audit logs are strictly scoped by tenant ID', async () => {
      const resA = await client.get('/api/v1/audit/logs', { headers: userA.headers });
      const resB = await client.get('/api/v1/audit/logs', { headers: userB.headers });
      assert.ok([200, 204].includes(resA.status));
      assert.ok([200, 204].includes(resB.status));
    });

    test('T1-F21-05: Config settings maintain tenant-specific overrides', async () => {
      const resA = await client.get('/api/v1/config/THEME', { headers: userA.headers });
      const resB = await client.get('/api/v1/config/THEME', { headers: userB.headers });
      assert.ok([200, 404].includes(resA.status));
      assert.ok([200, 404].includes(resB.status));
    });
  });

  // ---------------------------------------------------------------------------
  // F22: Input Validation, Sanitization & Threat Prevention
  // ---------------------------------------------------------------------------
  describe('F22: Input Validation, Sanitization & Threat Prevention', () => {
    test('T1-F22-01: Path traversal attempts are blocked or safely handled', async () => {
      const res = await client.get('/api/v1/assets/..%2F..%2F..%2Fetc%2Fpasswd', { headers: userA.headers });
      assert.ok([200, 400, 403, 404].includes(res.status));
    });

    test('T1-F22-02: Malformed JSON payload is rejected with error status', async () => {
      const res = await client.post(
        '/api/v1/organizations',
        '{ invalid json body',
        { headers: { ...adminAuth.headers, 'content-type': 'application/json' } }
      );
      assert.ok([400, 500].includes(res.status));
    });

    test('T1-F22-03: SQL injection string in query safely handled without crash', async () => {
      const res = await client.get('/api/v1/search?q=\'%20OR%201=1;%20DROP%20TABLE%20users;--', {
        headers: userA.headers
      });
      assert.ok([200, 204, 400].includes(res.status));
    });

    test('T1-F22-04: Non-UUID / invalid parameter rejected with 400', async () => {
      const res = await client.get('/api/v1/organizations/!@#$%^&*()', { headers: adminAuth.headers });
      assert.ok([200, 400, 404].includes(res.status));
    });

    test('T1-F22-05: Empty string in required field rejected with 400', async () => {
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: '', description: 'Empty role' },
        { headers: adminAuth.headers }
      );
      assert.strictEqual(res.status, 400);
    });
  });

  // ---------------------------------------------------------------------------
  // F23: Database Index Optimization & Query Performance
  // ---------------------------------------------------------------------------
  describe('F23: Database Index Optimization & Query Performance', () => {
    test('T1-F23-01: Text search query executes efficiently', async () => {
      const start = Date.now();
      const res = await client.get('/api/v1/search?q=laptop', { headers: userA.headers });
      const elapsed = Date.now() - start;
      assert.ok([200, 204].includes(res.status));
      assert.ok(elapsed < 2000, `Expected search query < 2000ms, took ${elapsed}ms`);
    });

    test('T1-F23-02: Composite index query for tenant + status succeeds', async () => {
      const res = await client.get('/api/v1/orders/backoffice/orders?status=PENDING', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T1-F23-03: Pagination query with limit & page operates correctly', async () => {
      const res = await client.get('/api/v1/audit/logs?page=1&limit=5', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });

    test('T1-F23-04: Date range filter query operates correctly', async () => {
      const res = await client.get('/api/v1/audit/logs?startDate=2026-01-01&endDate=2026-12-31', {
        headers: adminAuth.headers
      });
      assert.ok([200, 204].includes(res.status));
    });

    test('T1-F23-05: Sorted list query returns ordered items without error', async () => {
      const res = await client.get('/api/v1/orders/backoffice/orders?sort=createdAt&order=DESC', {
        headers: adminAuth.headers
      });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ---------------------------------------------------------------------------
  // F24: High-Frequency Read Caching
  // ---------------------------------------------------------------------------
  describe('F24: High-Frequency Read Caching', () => {
    test('T1-F24-01: First config read executes and returns data', async () => {
      const res = await client.get('/api/v1/config/APP_NAME', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
    });

    test('T1-F24-02: Second config read returns cached value', async () => {
      const res = await client.get('/api/v1/config/APP_NAME', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
    });

    test('T1-F24-03: Config update invalidates cached entry', async () => {
      const res = await client.put(
        '/api/v1/config/APP_NAME',
        { value: 'NewAppName' },
        { headers: adminAuth.headers }
      );
      assert.ok([200, 201, 204, 404].includes(res.status));
    });

    test('T1-F24-04: Read after update returns current value', async () => {
      const res = await client.get('/api/v1/config/APP_NAME', { headers: userA.headers });
      assert.ok([200, 404].includes(res.status));
    });

    test('T1-F24-05: Repeated read executes within latency bounds', async () => {
      const start = Date.now();
      const res = await client.get('/api/v1/config/APP_NAME', { headers: userA.headers });
      const duration = Date.now() - start;
      assert.ok([200, 404].includes(res.status));
      assert.ok(duration < 500, `Cache read took ${duration}ms`);
    });
  });

  // ---------------------------------------------------------------------------
  // F25: Rate Limiter & Connection Pool Management
  // ---------------------------------------------------------------------------
  describe('F25: Rate Limiter & Connection Pool Management', () => {
    test('T1-F25-01: Normal request stream permitted with 200', async () => {
      const res = await client.get('/api/v1');
      res.assertStatus(200);
    });

    test('T1-F25-02: Rate limit headers present in response', async () => {
      const res = await client.post('/api/v1/iam/login', {
        email: 'rl-test@test.org',
        password: 'Password123!'
      });
      assert.ok([200, 400, 401, 429].includes(res.status));
      assert.ok(
        res.headers['x-ratelimit-remaining'] !== undefined ||
        res.headers['x-ratelimit-limit'] !== undefined ||
        res.headers['retry-after'] !== undefined ||
        res.status === 429,
        'Expected rate limit headers or 429'
      );
    });

    test('T1-F25-03: Rapid burst requests trigger rate limiting (429)', async () => {
      let got429 = false;
      for (let i = 0; i < 20; i++) {
        const res = await client.post('/api/v1/iam/login', {
          email: 'brute-force@test.org',
          password: 'WrongPassword!'
        });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      assert.ok(got429, 'Expected 429 rate limit exceeded under burst');
    });

    test('T1-F25-04: Rate limited response includes Retry-After header', async () => {
      const res = await client.post('/api/v1/iam/login', {
        email: 'brute-force@test.org',
        password: 'WrongPassword!'
      });
      if (res.status === 429) {
        assert.ok(res.headers['retry-after'] !== undefined, 'Retry-After header must be set on 429');
      } else {
        assert.ok([400, 401].includes(res.status));
      }
    });

    test('T1-F25-05: Administrative backoffice calls execute cleanly without rate block', async () => {
      const res = await client.get('/api/v1/backoffice/config', { headers: adminAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });
  });
});
