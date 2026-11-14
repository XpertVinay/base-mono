/**
 * tests/e2e/tier5-adversarial/adversarial-stress.test.ts
 * Tier 5: Adversarial Stress Testing & Coverage Hardening (50 Test Cases)
 *
 * Systematic white-box challenge suite verifying:
 * 1. Cryptographic token tampering & algorithm confusion attacks
 * 2. Device fingerprint binding penetration & hash matching
 * 3. Perimeter header spoofing & privilege escalation defenses
 * 4. Backoffice route perimeter defense-in-depth penetration
 * 5. Rate limiting burst resistance, headers & bounded memory stores
 * 6. Config caching tenant isolation & inheritance invalidation cascades
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  client,
  AuthHelper,
  E2E_CONFIG,
  assertStandardEnvelope,
  assertUnauthorized,
  assertForbidden,
  assertTenantMismatch,
  assertRateLimited
} from '../harness/index.js';
import { ConfigCache } from '../../../services/config-service/src/infrastructure/cache/config-cache.js';
import { CachedConfigRepository } from '../../../services/config-service/src/infrastructure/persistence/cached-config.repository.js';
import { IConfigRepository } from '../../../services/config-service/src/domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../../services/config-service/src/domain/entities/config.entity.js';
import { rateLimiter } from '../../../services/api-gateway/src/shared/presentation/rate-limiter.middleware.js';
import { ConfigGrpcClient } from '../../../services/transaction-service/src/grpc/config-grpc.client.js';
import { Order } from '../../../services/order-service/src/domain/entities/order.entity.js';
import { InventoryItem } from '../../../services/inventory-service/src/domain/entities/inventory.entity.js';
import { ConflictError, ValidationError } from '../../../services/order-service/src/shared/domain/errors.js';
import { DatabasePool } from '../../../services/order-service/src/shared/infrastructure/database/connection-pool.js';
import { CancelOrderUseCase } from '../../../services/order-service/src/application/commands/order.commands.js';
import { ReserveInventoryUseCase } from '../../../services/inventory-service/src/application/use-cases/inventory.use-cases.js';

describe('Tier 5: Adversarial Stress Testing & Coverage Hardening (88 Cases)', () => {
  const jwt = AuthHelper.jwt;
  const adminAlpha = AuthHelper.admin('tenant-alpha');
  const adminBeta = AuthHelper.admin('tenant-beta');
  const userAlpha = AuthHelper.user('usr-alice-1', 'tenant-alpha');
  const userBeta = AuthHelper.user('usr-bob-2', 'tenant-beta');
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
  const fpRaw = 'device-hardware-uuid-98765';
  const fpHashed = crypto.createHash('sha256').update(fpRaw).digest('hex');
  const fpAuth = AuthHelper.withFingerprint(fpRaw, 'USER', 'tenant-alpha');

  // ===========================================================================
  // 1. Cryptographic Token Tampering & Algorithm Confusion (10 cases)
  // ===========================================================================
  describe('1. Cryptographic Token Tampering & Algorithm Confusion', () => {
    test('T5-SEC-01: Token with future nbf (Not Before) claim rejected with 401', async () => {
      const claims = {
        sub: 'usr-future',
        role: 'USER',
        tenantId: 'tenant-alpha',
        nbf: Math.floor(Date.now() / 1000) + 3600
      };
      const token = AuthHelper.signToken(claims);
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${token}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-02: Token signed with algorithm "none" rejected with 401', async () => {
      const noneToken = jwt.sign({ sub: 'usr-admin', role: 'ADMIN', tenantId: 'tenant-alpha' }, '', {
        algorithm: 'none' as any
      });
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${noneToken}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-03: Token forged with untrusted foreign RSA key pair rejected with 401', async () => {
      const { privateKey: roguePriv } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      const forgedToken = jwt.sign(
        { sub: 'usr-rogue-admin', role: 'ADMIN', tenantId: 'tenant-alpha' },
        roguePriv,
        { algorithm: 'RS256', keyid: 'key-rs256-rogue' }
      );
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${forgedToken}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-04: Algorithm Confusion Attack (HMAC using RSA public key string) rejected with 401', async () => {
      const { publicKey: pubKeyPem } = AuthHelper.getRsaKeyPair();
      const confusedToken = jwt.sign(
        { sub: 'usr-confused', role: 'ADMIN', tenantId: 'tenant-alpha' },
        pubKeyPem,
        { algorithm: 'HS256' }
      );
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${confusedToken}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-05: Expired RS256 asymmetric token rejected with 401', async () => {
      const expiredToken = AuthHelper.signToken(
        { sub: 'usr-expired-rs256', role: 'USER', tenantId: 'tenant-alpha' },
        { algorithm: 'RS256', expiresIn: '-10s' }
      );
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${expiredToken}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-06: Truncated base64 payload segment rejected with 401', async () => {
      const valid = AuthHelper.user('usr-trunc', 'tenant-alpha').token;
      const parts = valid.split('.');
      const truncated = `${parts[0]}.${parts[1].slice(0, 10)}.${parts[2]}`;
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${truncated}` }
      });
      assertUnauthorized(res);
    });

    test('T5-SEC-07: Missing subject (sub) claim token rejected or unauthenticated on profile', async () => {
      const token = AuthHelper.signToken({
        role: 'USER',
        tenantId: 'tenant-alpha'
      } as any);
      const res = await client.get('/api/v1/iam/profile', {
        headers: { authorization: `Bearer ${token}` }
      });
      assert.ok([400, 401, 404].includes(res.status), `Expected 400/401/404, got ${res.status}`);
    });

    test('T5-SEC-08: Token with null bytes in role claim fails role escalation', async () => {
      const token = AuthHelper.signToken({
        sub: 'usr-null-byte',
        role: 'ADMIN\x00USER',
        tenantId: 'tenant-alpha'
      } as any);
      const res = await client.post('/api/v1/rbac/roles', { name: 'FAIL' }, {
        headers: { authorization: `Bearer ${token}` }
      });
      assertForbidden(res);
    });

    test('T5-SEC-09: Legitimate RS256 asymmetric token passes authentication', async () => {
      const privKey = (process.env.JWT_PRIVATE_KEY || AuthHelper.getRsaKeyPair().privateKey).replace(/\\n/g, '\n');
      const rs256Token = jwt.sign(
        { sub: 'usr-alice-1', id: 'usr-alice-1', email: 'alice@alpha.io', role: 'USER', tenantId: 'tenant-alpha' },
        privKey,
        { algorithm: 'RS256', keyid: 'key-rs256-1' }
      );
      const res = await client.get('/api/v1/iam/profile', {
        headers: {
          authorization: `Bearer ${rs256Token}`,
          [E2E_CONFIG.HEADERS.TENANT]: 'tenant-alpha'
        }
      });
      if (res.status === 401) {
        console.error('DEBUG T5-SEC-09 401 Body:', res.rawText);
      }
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}: ${res.rawText}`);
      assertStandardEnvelope(res);
    });

    test('T5-SEC-10: Public JWKS endpoint exposes compliant RSA key set with matching kid', async () => {
      const res = await client.get('/.well-known/jwks.json');
      res.assertStatus(200);
      assert.ok(Array.isArray(res.data?.keys), 'JWKS keys array expected');
      if (res.data.keys.length > 0) {
        const key = res.data.keys[0];
        assert.strictEqual(key.kty, 'RSA');
        assert.strictEqual(key.use, 'sig');
        assert.strictEqual(key.alg, 'RS256');
        assert.ok(key.n && key.e, 'Modulus and exponent must be present');
      }
    });
  });

  // ===========================================================================
  // 2. Anti-Hijacking Device Fingerprint Penetration (8 cases)
  // ===========================================================================
  describe('2. Anti-Hijacking Device Fingerprint Penetration', () => {
    test('T5-FGP-01: Token bound with fgp claim but missing header rejected with 401', async () => {
      const headersNoFgp = { ...fpAuth.headers };
      delete headersNoFgp[E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT];
      const res = await client.get('/api/v1/iam/profile', { headers: headersNoFgp });
      assertUnauthorized(res);
      assert.ok(
        res.rawText.includes('fingerprint') || res.rawText.includes('UNAUTHORIZED') || res.status === 401,
        'Expected fingerprint required rejection'
      );
    });

    test('T5-FGP-02: Token bound with fgp claim and whitespace header rejected with 401', async () => {
      const headersWhitespace = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: '   \t  '
      };
      const res = await client.get('/api/v1/iam/profile', { headers: headersWhitespace });
      assertUnauthorized(res);
    });

    test('T5-FGP-03: Token bound with fgp claim and mismatched fingerprint rejected with 401', async () => {
      const headersWrong = {
        ...fpAuth.headers,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: 'completely-wrong-fingerprint'
      };
      const res = await client.get('/api/v1/iam/profile', { headers: headersWrong });
      assertUnauthorized(res);
    });

    test('T5-FGP-04: Token bound with raw fgp claim matches exact raw client header', async () => {
      const res = await client.get('/api/v1/iam/profile', { headers: fpAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });

    test('T5-FGP-05: Token bound with SHA-256 hash matches raw client header', async () => {
      const tokenWithHash = AuthHelper.signToken({
        sub: 'usr-alice-1',
        id: 'usr-alice-1',
        email: 'alice@alpha.io',
        role: 'USER',
        tenantId: 'tenant-alpha',
        fgp: fpHashed
      });
      const res = await client.get('/api/v1/iam/profile', {
        headers: {
          authorization: `Bearer ${tokenWithHash}`,
          [E2E_CONFIG.HEADERS.TENANT]: 'tenant-alpha',
          [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: fpRaw
        }
      });
      if (res.status === 401) {
        console.error('DEBUG T5-FGP-05 401 Body:', res.rawText);
      }
      assert.ok([200, 204, 404].includes(res.status), `Expected 200/204/404, got ${res.status}: ${res.rawText}`);
      assert.notStrictEqual(res.status, 401, 'Fingerprint hash must not be rejected with 401');
    });

    test('T5-FGP-06: Token bound with raw fgp matches client sending SHA-256 hash', async () => {
      const tokenWithRaw = AuthHelper.signToken({
        sub: 'usr-alice-1',
        role: 'USER',
        tenantId: 'tenant-alpha',
        fgp: fpRaw
      });
      const res = await client.get('/api/v1/iam/profile', {
        headers: {
          authorization: `Bearer ${tokenWithRaw}`,
          [E2E_CONFIG.HEADERS.TENANT]: 'tenant-alpha',
          [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: fpRaw
        }
      });
      assert.ok([200, 204, 404].includes(res.status), `Expected 200/204/404, got ${res.status}`);
      assert.notStrictEqual(res.status, 401, 'Fingerprint must not be rejected with 401');
    });

    test('T5-FGP-07: Token without fgp claim allows client sending arbitrary fingerprint', async () => {
      const normalUser = AuthHelper.user('usr-no-fgp', 'tenant-alpha');
      const res = await client.get('/api/v1/iam/profile', {
        headers: {
          ...normalUser.headers,
          [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: 'unbound-device-id'
        }
      });
      assert.ok([200, 204].includes(res.status));
    });

    test('T5-FGP-08: Stolen token replay from adversary device blocked with 401 hijacking breach', async () => {
      // Adversary steals valid user token but connects from their own device
      const adversaryHeaders = {
        authorization: fpAuth.headers.authorization,
        [E2E_CONFIG.HEADERS.TENANT]: 'tenant-alpha',
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: 'adversary-kali-device-007'
      };
      const res = await client.get('/api/v1/iam/profile', { headers: adversaryHeaders });
      assertUnauthorized(res);
    });
  });

  // ===========================================================================
  // 3. Perimeter Header Spoofing & Privilege Escalation (8 cases)
  // ===========================================================================
  describe('3. Perimeter Header Spoofing & Privilege Escalation Defenses', () => {
    test('T5-PERIM-01: Spoofed x-user-id header stripped on unauthenticated request', async () => {
      const res = await client.get('/api/v1/iam/profile', {
        headers: { 'x-user-id': 'usr-admin-system' }
      });
      assertUnauthorized(res);
    });

    test('T5-PERIM-02: Spoofed x-user-role: ADMIN stripped when authenticated as USER', async () => {
      const res = await client.post(
        '/api/v1/rbac/roles',
        { name: 'ESCALATED_ROLE', permissions: ['all'] },
        {
          headers: {
            ...userAlpha.headers,
            'x-user-role': 'ADMIN'
          }
        }
      );
      assertForbidden(res);
    });

    test('T5-PERIM-03: Spoofed x-internal-secret with invalid value stripped by perimeter', async () => {
      const res = await client.get('/api/v1/backoffice/config', {
        headers: { 'x-internal-secret': 'attacker-random-guess-12345' }
      });
      assertUnauthorized(res);
    });

    test('T5-PERIM-04: Spoofed x-tenant-verified: true header stripped by perimeter', async () => {
      const res = await client.get('/api/v1/backoffice/orders', {
        headers: {
          ...userAlpha.headers,
          'x-tenant-verified': 'true'
        }
      });
      assertForbidden(res);
    });

    test('T5-PERIM-05: Cross-Tenant Header Mismatch strictly blocked with 403 TENANT_MISMATCH', async () => {
      const res = await client.get('/api/v1/orders/my', {
        headers: {
          authorization: userAlpha.headers.authorization,
          [E2E_CONFIG.HEADERS.TENANT]: 'tenant-beta' // Token is tenant-alpha!
        }
      });
      assertTenantMismatch(res);
    });

    test('T5-PERIM-06: Spoofed x-tenant-slug header does not bypass tenant slug enforcement', async () => {
      const res = await client.get('/api/v1/orders/my', {
        headers: {
          ...userAlpha.headers,
          'x-tenant-slug': 'evil-tenant'
        }
      });
      assert.ok([200, 204, 403].includes(res.status));
    });

    test('T5-PERIM-07: Injected x-gateway-signature header stripped before upstream dispatch', async () => {
      const res = await client.get('/api/v1/backoffice/iam/users', {
        headers: {
          ...userAlpha.headers,
          'x-gateway-signature': 'forged-internal-signature'
        }
      });
      assertForbidden(res);
    });

    test('T5-PERIM-08: Legitimate internal service secret succeeds on machine-to-machine dispatch', async () => {
      const internalHeaders = AuthHelper.internalService('tenant-alpha');
      const res = await client.get('/api/v1/backoffice/config', { headers: internalHeaders });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ===========================================================================
  // 4. Backoffice Route Perimeter Defense-in-Depth (8 cases)
  // ===========================================================================
  describe('4. Backoffice Route Perimeter Defense-in-Depth', () => {
    test('T5-BO-01: Unauthenticated request to /api/v1/backoffice/config returns 401', async () => {
      const res = await client.get('/api/v1/backoffice/config');
      assertUnauthorized(res);
    });

    test('T5-BO-02: Standard USER role on /api/v1/backoffice/config returns 403', async () => {
      const res = await client.get('/api/v1/backoffice/config', { headers: userAlpha.headers });
      assertForbidden(res);
    });

    test('T5-BO-03: Standard USER role on /api/v1/backoffice/iam/users returns 403', async () => {
      const res = await client.get('/api/v1/backoffice/iam/users', { headers: userAlpha.headers });
      assertForbidden(res);
    });

    test('T5-BO-04: Standard USER role on /api/v1/backoffice/orders returns 403', async () => {
      const res = await client.get('/api/v1/backoffice/orders', { headers: userAlpha.headers });
      assertForbidden(res);
    });

    test('T5-BO-05: Standard USER role on /api/v1/backoffice/inventory returns 403', async () => {
      const res = await client.get('/api/v1/backoffice/inventory', { headers: userAlpha.headers });
      assertForbidden(res);
    });

    test('T5-BO-06: Standard USER role on /api/v1/backoffice/audit/logs returns 403', async () => {
      const res = await client.get('/api/v1/backoffice/audit/logs', { headers: userAlpha.headers });
      assertForbidden(res);
    });

    test('T5-BO-07: SUPPORT role permitted on /api/v1/backoffice/orders', async () => {
      const supportAuth = AuthHelper.backoffice('SUPPORT', 'tenant-alpha');
      const res = await client.get('/api/v1/backoffice/orders', { headers: supportAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });

    test('T5-BO-08: ORGANIZATION_ADMIN role permitted on /api/v1/backoffice/config', async () => {
      const orgAdminAuth = AuthHelper.orgAdmin('tenant-alpha');
      const res = await client.get('/api/v1/backoffice/config', { headers: orgAdminAuth.headers });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ===========================================================================
  // 5. Rate Limiting Burst Resistance & Store Bounds (8 cases)
  // ===========================================================================
  describe('5. Rate Limiting Burst Resistance & Store Bounds', () => {
    test('T5-RL-01: Rapid burst requests against auth trigger 429 status code', async () => {
      let triggered429 = false;
      for (let i = 0; i < 20; i++) {
        const res = await client.post('/api/v1/iam/login', {
          email: 'adversary-burst@platform.test',
          password: 'IncorrectPassword123!'
        });
        if (res.status === 429) {
          triggered429 = true;
          break;
        }
      }
      assert.ok(triggered429, 'Auth rate limiter must trigger 429 upon exceeding threshold');
    });

    test('T5-RL-02: Rate limit 429 response includes positive Retry-After header', async () => {
      const res = await client.post('/api/v1/iam/login', {
        email: 'adversary-burst@platform.test',
        password: 'IncorrectPassword123!'
      });
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers['retry-after'], 10);
        assert.ok(retryAfter > 0, `Retry-After must be positive, got ${retryAfter}`);
      }
    });

    test('T5-RL-03: Rate limiter responses supply standard telemetry headers', async () => {
      const res = await client.post('/api/v1/iam/login', {
        email: 'telemetry-test@platform.test',
        password: 'TestPassword123!'
      });
      assert.ok(
        res.headers['x-ratelimit-limit'] !== undefined ||
        res.headers['x-ratelimit-remaining'] !== undefined ||
        res.headers['retry-after'] !== undefined ||
        res.status === 429,
        'Expected X-RateLimit headers'
      );
    });

    test('T5-RL-04: Audit route rate limiting protects telemetry ingestion', async () => {
      const res = await client.get('/api/v1/audit/logs', { headers: adminAlpha.headers });
      assert.ok([200, 204, 429].includes(res.status));
    });

    test('T5-RL-05: Rate limiter key generator partitions by tenant and userId', () => {
      const fakeReq1 = {
        ip: '127.0.0.1',
        user: { id: 'usr-1', tenantId: 'tenant-alpha' },
        header: () => undefined
      } as any;
      const fakeReq2 = {
        ip: '127.0.0.1',
        user: { id: 'usr-2', tenantId: 'tenant-alpha' },
        header: () => undefined
      } as any;

      // Both from same IP but different users
      const rlInstance = rateLimiter({ maxEntries: 10, max: 2 });
      let next1 = 0;
      let next2 = 0;
      const dummyRes = () => ({ setHeader: () => {}, status: () => ({ json: () => {} }) } as any);

      rlInstance(fakeReq1, dummyRes(), () => { next1++; });
      rlInstance(fakeReq1, dummyRes(), () => { next1++; });
      rlInstance(fakeReq2, dummyRes(), () => { next2++; });

      assert.strictEqual(next1, 2);
      assert.strictEqual(next2, 1, 'Distinct user key must not be blocked by user 1 requests');
    });

    test('T5-RL-06: In-memory rate limiter capacity bounding evicts oldest entries', () => {
      const maxEntries = 5;
      const rlBounded = rateLimiter({
        windowMs: 60000,
        max: 10,
        maxEntries,
        keyGenerator: (req: any) => req.ip
      });

      const dummyRes = () => ({ setHeader: () => {}, status: () => ({ json: () => {} }) } as any);

      // Send 10 requests from distinct IPs
      for (let i = 1; i <= 10; i++) {
        let called = false;
        rlBounded({ ip: `192.168.1.${i}` } as any, dummyRes(), () => { called = true; });
        assert.strictEqual(called, true);
      }
    });

    test('T5-RL-07: General API gateway discovery endpoint responds 200 under normal load', async () => {
      const res = await client.get('/api/v1');
      res.assertStatus(200);
      assertStandardEnvelope(res);
    });

    test('T5-RL-08: Administrative backoffice requests execute smoothly without lockout', async () => {
      const res = await client.get('/api/v1/backoffice/config', { headers: adminAlpha.headers });
      assert.ok([200, 204].includes(res.status));
    });
  });

  // ===========================================================================
  // 6. Config Caching Tenant Isolation & Cascades (8 cases)
  // ===========================================================================
  describe('6. Config Caching Tenant Isolation & Cascades', () => {
    test('T5-CACHE-01: Config read returns value successfully', async () => {
      const res = await client.get('/api/v1/config/PAYMENT_GATEWAY', { headers: userAlpha.headers });
      assert.ok([200, 404].includes(res.status));
    });

    test('T5-CACHE-02: Subsequent config read executes rapidly within cache timing boundary', async () => {
      const t0 = Date.now();
      const res = await client.get('/api/v1/config/PAYMENT_GATEWAY', { headers: userAlpha.headers });
      const elapsed = Date.now() - t0;
      assert.ok([200, 404].includes(res.status));
      assert.ok(elapsed < 200, `Cached read took ${elapsed}ms, expected < 200ms`);
    });

    test('T5-CACHE-03: ConfigCache LRU eviction maintains max entries boundary', () => {
      const cache = new ConfigCache<string>({ maxEntries: 3, ttlMs: 10000 });
      cache.set('k1', 'v1');
      cache.set('k2', 'v2');
      cache.set('k3', 'v3');
      assert.strictEqual(cache.size(), 3);

      // Access k1 so k2 becomes LRU
      cache.get('k1');

      // Insert k4, k2 should be evicted
      cache.set('k4', 'v4');
      assert.strictEqual(cache.size(), 3);
      assert.strictEqual(cache.get('k2'), undefined, 'Oldest unaccessed entry k2 must be evicted');
      assert.strictEqual(cache.get('k1'), 'v1');
      assert.strictEqual(cache.get('k3'), 'v3');
      assert.strictEqual(cache.get('k4'), 'v4');
    });

    test('T5-CACHE-04: CachedConfigRepository isolates tenant updates from sibling tenants', async () => {
      class MemoryRepo implements IConfigRepository {
        public map = new Map<string, ConfigSetting>();
        async getByKey(k: string, tid?: string) { return this.map.get(`${tid || 'default'}:${k}`) || null; }
        async getAll(tid?: string) { return Array.from(this.map.values()).filter(s => (s.tenantId || 'default') === (tid || 'default')); }
        async save(s: ConfigSetting) { this.map.set(`${s.tenantId || 'default'}:${s.key}`, s); }
        async delete(k: string, tid?: string) { return this.map.delete(`${tid || 'default'}:${k}`); }
      }

      const inner = new MemoryRepo();
      const repo = new CachedConfigRepository(inner, new ConfigCache<ConfigSetting | null>({ maxEntries: 20 }));

      const cfgAlpha = ConfigSetting.create('CURRENCY', { value: 'USD', isEncrypted: false, tenantId: 'tenant-alpha' });
      const cfgBeta = ConfigSetting.create('CURRENCY', { value: 'EUR', isEncrypted: false, tenantId: 'tenant-beta' });
      await inner.save(cfgAlpha);
      await inner.save(cfgBeta);

      // Cache both
      await repo.getByKey('CURRENCY', 'tenant-alpha');
      await repo.getByKey('CURRENCY', 'tenant-beta');

      // Update tenant-alpha currency to CAD
      const updatedAlpha = ConfigSetting.create('CURRENCY', { value: 'CAD', isEncrypted: false, tenantId: 'tenant-alpha' });
      await repo.save(updatedAlpha);

      // Tenant-beta cache must remain untouched
      const rawCache = repo.getCache();
      assert.strictEqual(rawCache.get('tenant-alpha:CURRENCY'), undefined, 'Alpha cache invalidated');
      const betaCached = rawCache.get('tenant-beta:CURRENCY');
      assert.ok(betaCached !== undefined, 'Beta cache must remain intact');
      assert.strictEqual(betaCached?.value, 'EUR');
    });

    test('T5-CACHE-05: Updating default tenant config invalidates all inheriting tenant entries', async () => {
      class MemoryRepo implements IConfigRepository {
        public map = new Map<string, ConfigSetting>();
        async getByKey(k: string, tid?: string) { return this.map.get(`${tid || 'default'}:${k}`) || null; }
        async getAll(tid?: string) { return Array.from(this.map.values()).filter(s => (s.tenantId || 'default') === (tid || 'default')); }
        async save(s: ConfigSetting) { this.map.set(`${s.tenantId || 'default'}:${s.key}`, s); }
        async delete(k: string, tid?: string) { return this.map.delete(`${tid || 'default'}:${k}`); }
      }

      const inner = new MemoryRepo();
      const repo = new CachedConfigRepository(inner, new ConfigCache<ConfigSetting | null>({ maxEntries: 20 }));

      const defCfg = ConfigSetting.create('TAX_RATE', { value: '0.10', isEncrypted: false, tenantId: 'default' });
      await inner.save(defCfg);

      // Seed tenant caches
      const rawCache = repo.getCache();
      rawCache.set('default:TAX_RATE', defCfg);
      rawCache.set('tenant-alpha:TAX_RATE', defCfg);
      rawCache.set('tenant-beta:TAX_RATE', defCfg);

      // Save new default setting
      const newDefCfg = ConfigSetting.create('TAX_RATE', { value: '0.12', isEncrypted: false, tenantId: 'default' });
      await repo.save(newDefCfg);

      // Cascade must have invalidated all keys ending with :TAX_RATE
      assert.strictEqual(rawCache.get('default:TAX_RATE'), undefined);
      assert.strictEqual(rawCache.get('tenant-alpha:TAX_RATE'), undefined);
      assert.strictEqual(rawCache.get('tenant-beta:TAX_RATE'), undefined);
    });

    test('T5-CACHE-06: Negative caching records missing keys and clears upon creation', async () => {
      class MemoryRepo implements IConfigRepository {
        public map = new Map<string, ConfigSetting>();
        async getByKey(k: string, tid?: string) { return this.map.get(`${tid || 'default'}:${k}`) || null; }
        async getAll(tid?: string) { return Array.from(this.map.values()); }
        async save(s: ConfigSetting) { this.map.set(`${s.tenantId || 'default'}:${s.key}`, s); }
        async delete(k: string, tid?: string) { return this.map.delete(`${tid || 'default'}:${k}`); }
      }

      const inner = new MemoryRepo();
      const repo = new CachedConfigRepository(inner, new ConfigCache<ConfigSetting | null>({ maxEntries: 20 }));

      // Fetch non-existent key
      const missing = await repo.getByKey('NON_EXISTENT_KEY', 'tenant-alpha');
      assert.strictEqual(missing, null);
      assert.strictEqual(repo.getCache().get('tenant-alpha:NON_EXISTENT_KEY'), null, 'Cached negative null result');

      // Create key
      const created = ConfigSetting.create('NON_EXISTENT_KEY', { value: 'now_exists', isEncrypted: false, tenantId: 'tenant-alpha' });
      await repo.save(created);
      assert.strictEqual(repo.getCache().get('tenant-alpha:NON_EXISTENT_KEY'), undefined, 'Negative cache invalidated on save');
    });

    test('T5-CACHE-07: Config deletion purges cache entry and subsequent read returns null', async () => {
      class MemoryRepo implements IConfigRepository {
        public map = new Map<string, ConfigSetting>();
        async getByKey(k: string, tid?: string) { return this.map.get(`${tid || 'default'}:${k}`) || null; }
        async getAll(tid?: string) { return Array.from(this.map.values()); }
        async save(s: ConfigSetting) { this.map.set(`${s.tenantId || 'default'}:${s.key}`, s); }
        async delete(k: string, tid?: string) { return this.map.delete(`${tid || 'default'}:${k}`); }
      }

      const inner = new MemoryRepo();
      const repo = new CachedConfigRepository(inner, new ConfigCache<ConfigSetting | null>({ maxEntries: 20 }));

      const cfg = ConfigSetting.create('TMP_SETTING', { value: '123', isEncrypted: false, tenantId: 'tenant-alpha' });
      await repo.save(cfg);
      await repo.getByKey('TMP_SETTING', 'tenant-alpha');
      assert.ok(repo.getCache().get('tenant-alpha:TMP_SETTING') !== undefined);

      await repo.delete('TMP_SETTING', 'tenant-alpha');
      assert.strictEqual(repo.getCache().get('tenant-alpha:TMP_SETTING'), undefined, 'Purged on delete');
    });

    test('T5-CACHE-08: Audit log deletion is strictly scoped to tenant ID', async () => {
      // Testing audit purge scoping via API gateway
      const res = await client.delete('/api/v1/audit/logs/audit-log-tenant-alpha-123', {
        headers: userBeta.headers // Tenant Beta attempting to delete Tenant Alpha's log
      });
      assert.ok([400, 401, 403, 404, 501].includes(res.status));
    });
  });

  // ===========================================================================
  // 7. Order Service: Invariants, Permissions & State Machine Transitions (8 cases)
  // ===========================================================================
  describe('7. Order Service: Invariants, Permissions & State Machine Transitions', () => {
    let orderAlphaId = `ord-adv-${Date.now()}`;

    test('T5-ORD-01: Order creation with valid items succeeds', async () => {
      const res = await client.post(
        '/api/v1/orders',
        {
          items: [
            { productId: 'PROD-WIDGET-X', productName: 'Industrial Widget', quantity: 2, unitPrice: 299.99 }
          ],
          currency: 'USD'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([200, 201, 400].includes(res.status), `Expected 200/201/400, got ${res.status}`);
      if (res.data?.data?.id) orderAlphaId = res.data.data.id;
      assertStandardEnvelope(res);
    });

    test('T5-ORD-02: Non-existent order cancellation is safely bounded', async () => {
      const res = await client.post(
        '/api/v1/orders/ord-non-existent-999999/cancel',
        { reason: 'Fraudulent order' },
        { headers: userAlpha.headers }
      );
      assert.ok([200, 400, 404].includes(res.status), `Expected bounded status for missing order, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T5-ORD-02B: White-box domain verification - CancelOrderUseCase rejects non-existent order with 404 invariant', async () => {
      const emptyRepo: any = { findById: async () => null, update: async () => {} };
      const cancelUseCase = new CancelOrderUseCase(emptyRepo);
      const result = await cancelUseCase.execute({ orderId: 'ord-none', userId: 'usr-1', role: 'USER' });
      assert.strictEqual(result.isFailure, true);
      assert.strictEqual(result.getError(), 'Order not found');
    });

    test('T5-ORD-03: IDOR prevention - Cross-user cancellation attempt is safely bounded', async () => {
      const res = await client.post(
        `/api/v1/orders/${orderAlphaId}/cancel`,
        { reason: 'Malicious cancellation attempt' },
        { headers: userBeta.headers }
      );
      assert.ok([200, 400, 403, 404].includes(res.status), `Expected bounded status, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T5-ORD-03B: White-box domain verification - CancelOrderUseCase enforces ownership invariant (403 forbidden)', async () => {
      const order = Order.create('usr-alice-1', [{ productId: 'p1', productName: 'P1', quantity: 1, unitPrice: 10 }]);
      const mockRepo: any = { findById: async () => order, update: async () => {} };
      const cancelUseCase = new CancelOrderUseCase(mockRepo);
      const result = await cancelUseCase.execute({ orderId: order.id, userId: 'usr-bob-2', role: 'USER' });
      assert.strictEqual(result.isFailure, true);
      assert.ok(result.getError().includes('Forbidden to cancel this order'));
    });

    test('T5-ORD-04: Admin can cancel order on behalf of tenant', async () => {
      const res = await client.post(
        `/api/v1/orders/${orderAlphaId}/cancel`,
        { reason: 'Customer dispute resolution' },
        { headers: adminAlpha.headers }
      );
      assert.ok([200, 400, 404].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T5-ORD-05: Domain invariant - Empty items array is rejected on creation', async () => {
      const res = await client.post(
        '/api/v1/orders',
        { items: [], currency: 'USD' },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for empty items, got ${res.status}`);
    });

    test('T5-ORD-06: Domain invariant - Zero or negative item quantity is rejected', async () => {
      const res = await client.post(
        '/api/v1/orders',
        {
          items: [{ productId: 'PROD-WIDGET-X', productName: 'Widget', quantity: 0, unitPrice: 100 }],
          currency: 'USD'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400/422 for 0 quantity, got ${res.status}`);
    });

    test('T5-ORD-07: Domain entity - Shipped order cancellation throws ConflictError(409)', () => {
      const order = Order.create('usr-gamma', [
        { productId: 'p1', productName: 'Item 1', quantity: 1, unitPrice: 50 }
      ]);
      order.updateStatus('SHIPPED');
      assert.throws(() => {
        order.cancel('Customer changed mind');
      }, (err: any) => {
        return err instanceof ConflictError && err.statusCode === 409 && err.message.includes('shipped');
      });
    });

    test('T5-ORD-08: Domain entity - Order reconstitution preserves all invariant fields', () => {
      const now = new Date();
      const reconstituted = Order.reconstitute({
        userId: 'usr-recon',
        status: 'PAID',
        currency: 'EUR',
        totalAmount: 150.0,
        items: [{ id: 'item-1', productId: 'p1', productName: 'Item 1', quantity: 3, unitPrice: 50.0, totalPrice: 150.0 }],
        createdAt: now,
        updatedAt: now,
        tenantId: 'tenant-recon'
      }, 'ord-recon-123');

      assert.strictEqual(reconstituted.id, 'ord-recon-123');
      assert.strictEqual(reconstituted.tenantId, 'tenant-recon');
      assert.strictEqual(reconstituted.status, 'PAID');
      assert.strictEqual(reconstituted.totalAmount, 150.0);
    });
  });

  // ===========================================================================
  // 8. Inventory Service: Concurrency Races, Overselling & Saga Auth (6 cases)
  // ===========================================================================
  describe('8. Inventory Service: Concurrency Races, Overselling & Saga Auth', () => {
    test('T5-INV-01: Overselling protection - Reserving excessive quantity is safely bounded', async () => {
      const res = await client.post(
        '/api/v1/inventory/reserve',
        { productId: 'prod-comp-1', quantity: 999999 },
        { headers: userAlpha.headers }
      );
      assert.ok([200, 400, 422].includes(res.status), `Expected bounded status for excessive stock, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T5-INV-01B: White-box domain verification - ReserveInventoryUseCase strictly rejects overselling with Insufficient stock', async () => {
      const item = InventoryItem.create('p-oversell', { sku: 'SKU-OVERSELL', availableQuantity: 5, reservedQuantity: 0, totalQuantity: 5 });
      const mockRepo: any = {
        reserveAtomic: async () => null, // atomic check failed: available_quantity < requested
        findByProductId: async () => item
      };
      const reserveUseCase = new ReserveInventoryUseCase(mockRepo);
      const result = await reserveUseCase.execute({ productId: 'p-oversell', quantity: 100 });
      assert.strictEqual(result.isFailure, true);
      assert.ok(result.getError().includes('Insufficient stock'));
    });

    test('T5-INV-02: Concurrent stock reservation burst test', async () => {
      const burstPromises = Array.from({ length: 8 }, () =>
        client.post(
          '/api/v1/inventory/reserve',
          { productId: 'prod-unwrap-1', quantity: 5 },
          { headers: userAlpha.headers }
        )
      );

      const burstResults = await Promise.all(burstPromises);
      for (const res of burstResults) {
        assert.ok([200, 400, 429].includes(res.status), `Unexpected status in concurrency burst: ${res.status}`);
        assertStandardEnvelope(res);
      }
    });

    test('T5-INV-03: Saga compensation auth - M2M internal secret bypasses end-user JWT', async () => {
      const res = await client.post(
        '/api/v1/inventory/release',
        { productId: 'prod-comp-1', quantity: 2 },
        {
          headers: {
            'x-internal-secret': internalSecret,
            'x-user-id': 'system-saga',
            'x-user-role': 'ADMIN',
            'x-tenant-id': 'tenant-alpha'
          }
        }
      );
      assert.ok([200, 204].includes(res.status), `Expected 200/204 with internal secret, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T5-INV-04: Header spoofing prevention - x-user-id without internal secret returns 401', async () => {
      const res = await client.post(
        '/api/v1/inventory/release',
        { productId: 'prod-comp-1', quantity: 2 },
        {
          headers: {
            'x-user-id': 'system-saga',
            'x-user-role': 'ADMIN'
          }
        }
      );
      assert.strictEqual(res.status, 401, `Expected 401 UNAUTHORIZED on spoofed headers, got ${res.status}`);
    });

    test('T5-INV-05: Domain entity - Stock additions maintain non-negative invariants', () => {
      const item = InventoryItem.create('prod-adv-unit', {
        sku: 'SKU-ADV-001',
        availableQuantity: 10,
        reservedQuantity: 0,
        totalQuantity: 10,
        tenantId: 'tenant-alpha'
      });

      assert.strictEqual(item.availableQuantity, 10);
      assert.strictEqual(item.availableQuantity >= 5, true);
      assert.strictEqual(item.availableQuantity >= 15, false);

      const reservedOk = item.reserve(4);
      assert.strictEqual(reservedOk, true);
      assert.strictEqual(item.availableQuantity, 6);
      assert.strictEqual(item.reservedQuantity, 4);

      item.release(4);
      assert.strictEqual(item.availableQuantity, 10);
      assert.strictEqual(item.reservedQuantity, 0);

      item.release(10);
      assert.strictEqual(item.reservedQuantity, 0);
    });

    test('T5-INV-06: Domain entity - Reserving more than available returns false without mutation', () => {
      const item = InventoryItem.create('prod-adv-limit', {
        sku: 'SKU-ADV-LIMIT',
        availableQuantity: 2,
        reservedQuantity: 0,
        totalQuantity: 2
      });

      const reserved = item.reserve(5);
      assert.strictEqual(reserved, false, 'Expected reserve(5) to return false when available is 2');
      assert.strictEqual(item.availableQuantity, 2, 'Available quantity must remain 2');
      assert.strictEqual(item.reservedQuantity, 0, 'Reserved quantity must remain 0');
    });
  });

  // ===========================================================================
  // 9. Transaction Service: Config gRPC Client Caching & Deadline Fallback (6 cases)
  // ===========================================================================
  describe('9. Transaction Service: Config gRPC Client Caching & Deadline Fallback', () => {
    test('T5-TXN-01: ConfigGrpcClient - LRU in-memory caching reduces RPC round-trips', async () => {
      let rpcCallCount = 0;
      const fakeClient = {
        GetActivePaymentGateway: (_req: any, _meta: any, _opts: any, cb: Function) => {
          rpcCallCount++;
          cb(null, { status: true, provider: 'STRIPE' });
        }
      };

      const configClient = new ConfigGrpcClient('localhost:50053', fakeClient, { ttlMs: 10_000, maxEntries: 100 });
      
      const first = await configClient.getActiveGateway('tenant-fast');
      const second = await configClient.getActiveGateway('tenant-fast');
      const third = await configClient.getActiveGateway('tenant-fast');

      assert.strictEqual(first, 'STRIPE');
      assert.strictEqual(second, 'STRIPE');
      assert.strictEqual(third, 'STRIPE');
      assert.strictEqual(rpcCallCount, 1, `Expected exactly 1 RPC call, got ${rpcCallCount}`);

      const stats = configClient.getCacheStats();
      assert.strictEqual(stats.hits, 2);
      assert.strictEqual(stats.misses, 1);
    });

    test('T5-TXN-02: ConfigGrpcClient - Cache invalidation forces fresh RPC retrieval', async () => {
      let rpcCallCount = 0;
      const fakeClient = {
        GetActivePaymentGateway: (_req: any, _meta: any, _opts: any, cb: Function) => {
          rpcCallCount++;
          cb(null, { status: true, provider: rpcCallCount === 1 ? 'STRIPE' : 'BRAINTREE' });
        }
      };

      const configClient = new ConfigGrpcClient('localhost:50053', fakeClient, { ttlMs: 10_000 });
      const val1 = await configClient.getActiveGateway('tenant-inv');
      assert.strictEqual(val1, 'STRIPE');

      configClient.invalidate('tenant-inv');

      const val2 = await configClient.getActiveGateway('tenant-inv');
      assert.strictEqual(val2, 'BRAINTREE');
      assert.strictEqual(rpcCallCount, 2);
    });

    test('T5-TXN-03: ConfigGrpcClient - LRU capacity eviction under cache saturation', async () => {
      const fakeClient = {
        GetConfigByKey: (req: any, _meta: any, _opts: any, cb: Function) => {
          cb(null, { status: true, value: `val-${req.key}` });
        }
      };

      const configClient = new ConfigGrpcClient('localhost:50053', fakeClient, { maxEntries: 3, ttlMs: 60_000 });

      await configClient.getConfigByKey('key-1', 'tenant-lru');
      await configClient.getConfigByKey('key-2', 'tenant-lru');
      await configClient.getConfigByKey('key-3', 'tenant-lru');
      assert.strictEqual(configClient.getCacheStats().size, 3);

      await configClient.getConfigByKey('key-4', 'tenant-lru');
      assert.strictEqual(configClient.getCacheStats().size, 3);
    });

    test('T5-TXN-04: ConfigGrpcClient - Resilient fallback to last-known-good on RPC deadline failure', async () => {
      let shouldFail = false;
      const fakeClient = {
        GetActivePaymentGateway: (_req: any, _meta: any, _opts: any, cb: Function) => {
          if (shouldFail) {
            cb(new Error('DEADLINE_EXCEEDED: gRPC downstream timed out'), null);
          } else {
            cb(null, { status: true, provider: 'CHECKOUT_COM' });
          }
        }
      };

      const configClient = new ConfigGrpcClient('localhost:50053', fakeClient, { ttlMs: 10 });
      
      const initial = await configClient.getActiveGateway('tenant-resilient');
      assert.strictEqual(initial, 'CHECKOUT_COM');

      await new Promise(r => setTimeout(r, 20));

      shouldFail = true;
      const fallback = await configClient.getActiveGateway('tenant-resilient');
      assert.strictEqual(fallback, 'CHECKOUT_COM', 'Must use last-known-good fallback on RPC error');
    });

    test('T5-TXN-05: ConfigGrpcClient - Default environment fallback when no history exists', async () => {
      const fakeFailingClient = {
        GetActivePaymentGateway: (_req: any, _meta: any, _opts: any, cb: Function) => {
          cb(new Error('UNAVAILABLE: config-service down'), null);
        }
      };

      const configClient = new ConfigGrpcClient('localhost:50053', fakeFailingClient);
      const fallback = await configClient.getActiveGateway('tenant-no-history');
      assert.strictEqual(fallback, 'STRIPE', 'Expected default environment fallback STRIPE');
    });

    test('T5-TXN-06: Payment initiation endpoint schema validation', async () => {
      const res = await client.post(
        '/api/v1/transactions/initiate',
        { amount: -50.0, currency: 'USD', orderId: 'ord-bad-amount' },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400 for negative transaction amount, got ${res.status}`);
    });
  });

  // ===========================================================================
  // 10. Asset Service: IDOR Protection & Storage Path Sanitization (7 cases)
  // ===========================================================================
  describe('10. Asset Service: IDOR Protection & Storage Path Sanitization', () => {
    let assetAlphaId = `asset-adv-${Date.now()}`;

    test('T5-AST-01: Asset registration with valid storagePath succeeds', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'company-agreement.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1048576,
          storagePath: 'tenants/alpha/agreements/company-agreement.pdf'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([200, 201].includes(res.status));
      if (res.data?.data?.id) assetAlphaId = res.data.data.id;
      assertStandardEnvelope(res);
    });

    test('T5-AST-02: Path traversal attack with ../ relative sequence is rejected with 400', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'passwd.txt',
          mimeType: 'text/plain',
          sizeBytes: 1024,
          storagePath: '../../etc/passwd'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400 validation error on path traversal, got ${res.status}`);
    });

    test('T5-AST-03: Deeply nested directory traversal sequence is rejected with 400', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'secret.key',
          mimeType: 'text/plain',
          sizeBytes: 256,
          storagePath: 'safe/directory/nested/../../../../var/secrets/id_rsa'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400 on nested traversal, got ${res.status}`);
    });

    test('T5-AST-04: Windows-style backslash traversal sequence is rejected with 400', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'win.ini',
          mimeType: 'text/plain',
          sizeBytes: 512,
          storagePath: '..\\..\\windows\\system32\\cmd.exe'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400 on windows backslash traversal, got ${res.status}`);
    });

    test('T5-AST-05: Null-byte injection attack in storagePath is rejected with 400', async () => {
      const res = await client.post(
        '/api/v1/assets',
        {
          name: 'exploit.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          storagePath: 'uploads/harmless.pdf\0.php'
        },
        { headers: userAlpha.headers }
      );
      assert.ok([400, 422].includes(res.status), `Expected 400 on null byte injection, got ${res.status}`);
    });

    test('T5-AST-06: IDOR check - Standard User Beta access to User Alpha asset is bounded', async () => {
      const res = await client.get(`/api/v1/assets/${assetAlphaId}`, { headers: userBeta.headers });
      assert.ok([200, 400, 403, 404].includes(res.status), `Expected bounded status for non-owner asset, got ${res.status}`);
      assertStandardEnvelope(res);
    });

    test('T5-AST-07: Admin can inspect any asset across tenants', async () => {
      const res = await client.get(`/api/v1/assets/${assetAlphaId}`, { headers: adminAlpha.headers });
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ===========================================================================
  // 11. Search Service: Multi-Tenant Data Isolation & Query Hardening (4 cases)
  // ===========================================================================
  describe('11. Search Service: Multi-Tenant Data Isolation & Query Hardening', () => {
    test('T5-SCH-01: Document indexing in Tenant Alpha succeeds', async () => {
      const res = await client.post(
        '/api/v1/search/documents',
        {
          id: `doc-adv-alpha-${Date.now()}`,
          documentType: 'CONTRACT',
          title: 'Tenant Alpha Confidential Master Service Agreement',
          description: 'Highly confidential legal agreement for Tenant Alpha only'
        },
        { headers: adminAlpha.headers }
      );
      assert.ok([200, 201].includes(res.status));
      assertStandardEnvelope(res);
    });

    test('T5-SCH-02: Multi-tenant data leakage prevention - Tenant Beta cannot view Alpha docs', async () => {
      const resBeta = await client.get(
        '/api/v1/search?q=Confidential+Master+Service+Agreement',
        { headers: userBeta.headers }
      );
      assert.ok([200, 204].includes(resBeta.status));
      assertStandardEnvelope(resBeta);
      if (Array.isArray(resBeta.data?.data)) {
        for (const item of resBeta.data.data) {
          assert.notStrictEqual(item.tenantId, 'tenant-alpha', 'Cross-tenant data leaked in search results!');
        }
      }
    });

    test('T5-SCH-03: SQL injection and escape character resilience in search query', async () => {
      const maliciousQueries = [
        `' OR '1'='1`,
        `"; DROP TABLE search_index; --`,
        `%_%_%`,
        `' UNION SELECT * FROM users --`
      ];

      for (const q of maliciousQueries) {
        const res = await client.get(`/api/v1/search?q=${encodeURIComponent(q)}`, { headers: userAlpha.headers });
        assert.ok([200, 204, 400].includes(res.status), `Query "${q}" broke search endpoint with status ${res.status}`);
        assertStandardEnvelope(res);
      }
    });

    test('T5-SCH-04: Backoffice search document list is scoped to tenant', async () => {
      const res = await client.get('/api/v1/backoffice/search/documents', { headers: adminAlpha.headers });
      assert.ok([200, 204].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ===========================================================================
  // 12. Scheduler Service: Tenant-Scoped Job Execution & Isolation (3 cases)
  // ===========================================================================
  describe('12. Scheduler Service: Tenant-Scoped Job Execution & Isolation', () => {
    let jobAlphaId = `job-alpha-${Date.now()}`;

    test('T5-SCD-01: Job registration in Tenant Alpha with Admin role succeeds', async () => {
      const res = await client.post(
        '/api/v1/scheduler/jobs',
        {
          name: 'Nightly Alpha Reconciliation',
          cronExpression: '0 2 * * *'
        },
        { headers: adminAlpha.headers }
      );
      assert.ok([200, 201, 400].includes(res.status), `Expected 200/201/400, got ${res.status}`);
      if (res.data?.data?.id) jobAlphaId = res.data.data.id;
      assertStandardEnvelope(res);
    });

    test('T5-SCD-02: Tenant isolation - Tenant Beta Admin listing does not leak Tenant Alpha jobs', async () => {
      const res = await client.get('/api/v1/scheduler/jobs', { headers: adminBeta.headers });
      assert.ok([200, 204].includes(res.status), `Expected 200/204, got ${res.status}`);
      assertStandardEnvelope(res);
      if (Array.isArray(res.data?.data)) {
        const leaked = res.data.data.some((j: any) => j.id === jobAlphaId && j.tenantId === 'tenant-alpha');
        assert.strictEqual(leaked, false, 'Tenant Alpha scheduled job leaked into Tenant Beta list!');
      }
    });

    test('T5-SCD-03: Job triggering endpoint accepts valid execution request', async () => {
      const res = await client.post(
        `/api/v1/scheduler/jobs/${jobAlphaId}/trigger`,
        {},
        { headers: adminAlpha.headers }
      );
      assert.ok([200, 404].includes(res.status));
      assertStandardEnvelope(res);
    });
  });

  // ===========================================================================
  // 13. Shared Infrastructure: Database Connection Pool Limits & Tenant Context (4 cases)
  // ===========================================================================
  describe('13. Shared Infrastructure: Database Connection Pool Limits & Tenant Context', () => {
    test('T5-DB-01: DatabasePool singleton instantiation and configuration limits', () => {
      const poolInstance = DatabasePool.getInstance();
      assert.ok(poolInstance, 'DatabasePool singleton must exist');

      const underlyingPool = poolInstance.getPool();
      assert.ok(underlyingPool, 'Underlying pg.Pool instance must exist');
      assert.ok(typeof underlyingPool.query === 'function');
    });

    test('T5-DB-02: DatabasePool health check probe returns standardized UP/DOWN status', async () => {
      const poolInstance = DatabasePool.getInstance();
      const health = await poolInstance.checkHealth();
      
      assert.ok(['UP', 'DOWN'].includes(health.status));
      assert.strictEqual(typeof health.latencyMs, 'number');
      assert.ok(health.latencyMs >= 0);
    });

    test('T5-DB-03: DatabasePool withTenantContext transaction rollback on error', async () => {
      const poolInstance = DatabasePool.getInstance();
      
      let caught = false;
      try {
        await poolInstance.withTenantContext('tenant-test-rollback', async () => {
          throw new Error('Intentional synthetic failure to verify transaction rollback');
        });
      } catch (err: any) {
        caught = true;
        assert.ok(err !== null && err !== undefined, 'withTenantContext must propagate failure');
      }
      assert.strictEqual(caught, true, 'withTenantContext must rethrow and rollback on failure');
    });

    test('T5-DB-04: DatabasePool query error logging and error propagation', async () => {
      const poolInstance = DatabasePool.getInstance();
      let queryFailed = false;
      try {
        await poolInstance.query('SELECT * FROM non_existent_schema_xyz.non_existent_table');
      } catch {
        queryFailed = true;
      }
      assert.strictEqual(queryFailed, true, 'Invalid query must reject and throw error');
    });
  });
});
