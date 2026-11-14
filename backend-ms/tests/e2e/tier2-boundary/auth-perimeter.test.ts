/**
 * tests/e2e/tier2-boundary/auth-perimeter.test.ts
 * Tier 2 Boundary Coverage: Authentication, Authorization & Perimeter Defense (45 Test Cases)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { client, AuthHelper, E2E_CONFIG, assertUnauthorized, assertForbidden } from '../harness/index.js';

describe('Tier 2: Authentication, Authorization & Perimeter Boundaries (45 Cases)', () => {
  const adminAuth = AuthHelper.admin();
  const userA = AuthHelper.user('usr-alice-1', 'tenant-alpha');
  const userB = AuthHelper.user('usr-bob-2', 'tenant-beta');
  const fpAuth = AuthHelper.withFingerprint(E2E_CONFIG.TEST_DEVICE_FINGERPRINT, 'USER', 'tenant-alpha');

  // ---------------------------------------------------------------------------
  // 1. Missing Authorization Headers (10 cases)
  // ---------------------------------------------------------------------------
  describe('Missing Authorization Headers on Protected Routes', () => {
    const protectedRoutes = [
      '/api/v1/iam/profile',
      '/api/v1/orders/my',
      '/api/v1/assets',
      '/api/v1/config/APP_NAME',
      '/api/v1/scheduler/jobs',
      '/api/v1/audit/logs',
      '/api/v1/backoffice/iam/users',
      '/api/v1/backoffice/inventory',
      '/api/v1/ai/providers',
      '/api/v1/backoffice/orders'
    ];

    for (let i = 0; i < protectedRoutes.length; i++) {
      const route = protectedRoutes[i];
      test(`T2-AUTH-MISSING-${i + 1}: GET ${route} rejects unauthenticated request`, async () => {
        const res = await client.get(route);
        assert.ok([401, 403].includes(res.status), `Expected 401/403, got ${res.status}`);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Malformed & Invalid Token Encodings (8 cases)
  // ---------------------------------------------------------------------------
  describe('Malformed & Invalid Token Encodings', () => {
    const malformedHeaders = [
      { authorization: 'Bearer not-a-valid-jwt-token' },
      { authorization: 'Bearer abc.def' },
      { authorization: 'Bearer ' },
      { authorization: 'Basic dXNlcjpwYXNz' },
      { authorization: 'Token abcdef123456789' },
      { authorization: 'bearer ' + userA.token },
      { authorization: 'Bearer ' + userA.token + ' extra_garbage' },
      { authorization: 'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.' } // alg: none
    ];

    for (let i = 0; i < malformedHeaders.length; i++) {
      test(`T2-AUTH-MALFORMED-${i + 1}: Malformed token variant ${i + 1} rejected`, async () => {
        const res = await client.get('/api/v1/iam/profile', { headers: malformedHeaders[i] });
        assertUnauthorized(res);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Expired Tokens Across Services (6 cases)
  // ---------------------------------------------------------------------------
  describe('Expired Tokens Rejection', () => {
    const expiredRoutes = [
      '/api/v1/iam/profile',
      '/api/v1/orders/my',
      '/api/v1/assets',
      '/api/v1/config/APP_NAME',
      '/api/v1/backoffice/iam/users',
      '/api/v1/backoffice/orders'
    ];

    for (let i = 0; i < expiredRoutes.length; i++) {
      const route = expiredRoutes[i];
      test(`T2-AUTH-EXPIRED-${i + 1}: Expired token rejected on ${route}`, async () => {
        const expired = AuthHelper.expired('tenant-alpha');
        const res = await client.get(route, { headers: expired.headers });
        assertUnauthorized(res);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Tampered Signatures Across Services (6 cases)
  // ---------------------------------------------------------------------------
  describe('Tampered Signatures Rejection', () => {
    const tamperedRoutes = [
      '/api/v1/iam/profile',
      '/api/v1/orders/my',
      '/api/v1/assets',
      '/api/v1/config/APP_NAME',
      '/api/v1/backoffice/iam/users',
      '/api/v1/backoffice/orders'
    ];

    for (let i = 0; i < tamperedRoutes.length; i++) {
      const route = tamperedRoutes[i];
      test(`T2-AUTH-TAMPERED-${i + 1}: Tampered signature rejected on ${route}`, async () => {
        const tampered = AuthHelper.tampered('tenant-alpha');
        const res = await client.get(route, { headers: tampered.headers });
        assertUnauthorized(res);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Anti-Hijacking Device Fingerprint Defenses (5 cases)
  // ---------------------------------------------------------------------------
  describe('Anti-Hijacking Device Fingerprint Defenses', () => {
    test('T2-FGP-01: Token with fgp claim missing header rejected with 401', async () => {
      const headersNoFgp = { ...fpAuth.headers };
      delete headersNoFgp[E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT];
      const res = await client.get('/api/v1/iam/profile', { headers: headersNoFgp });
      assertUnauthorized(res);
    });

    test('T2-FGP-02: Token with fgp claim and spoofed header rejected with 401', async () => {
      const spoofedHeaders = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: E2E_CONFIG.DEVICE_FINGERPRINTS.SPOOFED
      };
      const res = await client.get('/api/v1/iam/profile', { headers: spoofedHeaders });
      assertUnauthorized(res);
    });

    test('T2-FGP-03: Empty string fingerprint header rejected with 401', async () => {
      const emptyFgpHeaders = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: ''
      };
      const res = await client.get('/api/v1/iam/profile', { headers: emptyFgpHeaders });
      assertUnauthorized(res);
    });

    test('T2-FGP-04: Non-matching uppercase/lowercase fingerprint rejected with 401', async () => {
      const alteredFgpHeaders = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: E2E_CONFIG.TEST_DEVICE_FINGERPRINT.toUpperCase()
      };
      const res = await client.get('/api/v1/iam/profile', { headers: alteredFgpHeaders });
      assertUnauthorized(res);
    });

    test('T2-FGP-05: Valid matching device fingerprint allows access', async () => {
      const res = await client.get('/api/v1/iam/profile', { headers: fpAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Role Escalation & Privilege Boundaries (6 cases)
  // ---------------------------------------------------------------------------
  describe('Role Escalation & Privilege Boundaries', () => {
    test('T2-ROLE-01: Standard USER cannot create RBAC role', async () => {
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: 'SUPER_ESCALATED', permissions: ['all'] },
        { headers: userA.headers }
      );
      assertForbidden(res);
    });

    test('T2-ROLE-02: Standard USER cannot create organizations', async () => {
      const res = await client.post(
        '/api/v1/organizations',
        { name: 'Hacked Org', slug: 'hacked-org', contactEmail: 'hacker@org.com' },
        { headers: userA.headers }
      );
      assertForbidden(res);
    });

    test('T2-ROLE-03: Standard USER cannot register AI provider', async () => {
      const res = await client.post(
        '/api/v1/ai/providers',
        { name: 'Rogue AI', slug: 'rogue-ai', providerType: 'openai' },
        { headers: userA.headers }
      );
      assertForbidden(res);
    });

    test('T2-ROLE-04: Standard USER cannot access backoffice audit logs', async () => {
      const res = await client.get('/api/v1/backoffice/audit/logs', { headers: userA.headers });
      assertForbidden(res);
    });

    test('T2-ROLE-05: Standard USER cannot access backoffice IAM users', async () => {
      const res = await client.get('/api/v1/backoffice/iam/users', { headers: userA.headers });
      assertForbidden(res);
    });

    test('T2-ROLE-06: Standard USER cannot access backoffice orders overview', async () => {
      const res = await client.get('/api/v1/backoffice/orders', { headers: userA.headers });
      assertForbidden(res);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Perimeter Header Sanitization & Spoofing Resistance (4 cases)
  // ---------------------------------------------------------------------------
  describe('Perimeter Header Sanitization & Spoofing Resistance', () => {
    test('T2-PERIM-01: Injected x-user-role header stripped by gateway', async () => {
      const spoofHeaders = {
        ...userA.headers,
        'x-user-role': 'ADMIN'
      };
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: 'ESCALATED', permissions: ['all'] },
        { headers: spoofHeaders }
      );
      assertForbidden(res);
    });

    test('T2-PERIM-02: Injected x-user-id header does not hijack profile', async () => {
      const spoofHeaders = {
        ...userA.headers,
        'x-user-id': 'usr-victim-victim'
      };
      const res = await client.get('/api/v1/iam/profile', { headers: spoofHeaders });
      assert.ok([200, 204].includes(res.status));
      if (res.data?.data?.id) {
        assert.notStrictEqual(res.data.data.id, 'usr-victim-victim');
      }
    });

    test('T2-PERIM-03: Injected x-internal-secret header from unauthenticated client rejected', async () => {
      const res = await client.get('/api/v1/backoffice/config', {
        headers: {
          'x-internal-secret': E2E_CONFIG.INTERNAL_SERVICE_SECRET
        }
      });
      assert.ok([401, 403].includes(res.status));
    });

    test('T2-PERIM-04: Injected x-tenant-verified header does not bypass tenant verification', async () => {
      const res = await client.get('/api/v1/backoffice/orders', {
        headers: {
          ...userA.headers,
          'x-tenant-verified': 'true'
        }
      });
      assertForbidden(res);
    });
  });
});
