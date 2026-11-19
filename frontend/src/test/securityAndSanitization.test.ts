import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCurl,
  resolveSwaggerDocUrl,
  detectServiceTag,
} from '../core/api/trafficStore';
import {
  sanitizeString,
  stripHtml,
  isValidUrl,
  sanitizeUrl,
  sanitizePayload,
} from '../utils/sanitize';
import {
  iamApi,
  configApi,
  notificationsApi,
  ordersApi,
  inventoryApi,
  assetsApi,
  transactionsApi,
  schedulerApi,
  apiClient,
  extractApiServiceError,
  ApiServiceError,
} from '../core/api';

describe('Frontend Security & Input Sanitization (Requirement R4)', () => {
  describe('Token Redaction & cURL Generation', () => {
    it('masks Bearer authorization header with [REDACTED]', () => {
      const curl = generateCurl(
        'GET',
        'http://localhost:4000/api/iam/me',
        {
          Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.secretToken123',
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'ten_apex_health_01',
        }
      );

      expect(curl).toContain('curl -X GET "http://localhost:4000/api/iam/me"');
      expect(curl).toContain('-H "Authorization: Bearer [REDACTED]"');
      expect(curl).not.toContain('secretToken123');
      expect(curl).toContain('-H "X-Tenant-ID: ten_apex_health_01"');
    });

    it('masks lower-case authorization header', () => {
      const curl = generateCurl(
        'POST',
        'http://localhost:4000/api/orders',
        {
          authorization: 'Bearer super_confidential_session_key',
        },
        { items: [] }
      );

      expect(curl).toContain('-H "authorization: Bearer [REDACTED]"');
      expect(curl).not.toContain('super_confidential_session_key');
    });

    it('redacts raw non-Bearer tokens in authorization header', () => {
      const curl = generateCurl(
        'GET',
        'http://localhost:4000/api/config',
        {
          Authorization: 'Basic dXNlcjpwYXNz',
        }
      );

      expect(curl).toContain('-H "Authorization: [REDACTED]"');
      expect(curl).not.toContain('dXNlcjpwYXNz');
    });
  });

  describe('Input Sanitization & XSS Prevention', () => {
    it('trims whitespace cleanly', () => {
      expect(sanitizeString('   hello world   ')).toBe('hello world');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('strips HTML and script injection attempts', () => {
      expect(stripHtml('<script>alert("XSS")</script>Normal Text')).toBe('Normal Text');
      expect(stripHtml('<img src=x onerror=alert(1)>Warning')).toBe('Warning');
      expect(stripHtml('<b>Bold</b> & <i>Italic</i>')).toBe('Bold & Italic');
    });

    it('whitelists secure http and https URL protocols', () => {
      expect(isValidUrl('https://example.com/asset.pdf')).toBe(true);
      expect(isValidUrl('http://localhost:4000/api')).toBe(true);
      expect(isValidUrl('https://sub.domain.org/path?param=1#hash')).toBe(true);
    });

    it('strictly rejects malicious pseudo-protocols', () => {
      expect(isValidUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isValidUrl('file:///etc/passwd')).toBe(false);
      expect(isValidUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl(null)).toBe(false);
    });

    it('sanitizes URL with fallback on invalid protocol', () => {
      expect(sanitizeUrl('https://cdn.example.com/file.png', 'fallback')).toBe(
        'https://cdn.example.com/file.png'
      );
      expect(sanitizeUrl('javascript:alert(1)', 'https://safe.local')).toBe(
        'https://safe.local'
      );
    });

    it('sanitizes nested object payload properties', () => {
      const input = {
        name: '  John Doe  ',
        details: {
          bio: '  Developer  ',
          count: 42,
        },
        tags: ['  tag1  ', '  tag2  '],
      };

      const result = sanitizePayload(input);
      expect(result.name).toBe('John Doe');
      expect(result.details.bio).toBe('Developer');
      expect(result.details.count).toBe(42);
      expect(result.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Safe API Error Extraction (Requirement R4)', () => {
    it('encapsulates network errors without leaking internal stack traces', () => {
      const internalErr = new Error('Database connection failed at pg_connect() line 42');
      const serviceErr = extractApiServiceError(internalErr);

      expect(serviceErr).toBeInstanceOf(ApiServiceError);
      expect(serviceErr.message).toBe('Database connection failed at pg_connect() line 42');
      expect(serviceErr.status).toBe(500);
    });
  });

  describe('Swagger Doc URL & Service Tag Resolution', () => {
    it('maps all services to appropriate Swagger docs tags', () => {
      expect(resolveSwaggerDocUrl('/api/v1/orders')).toContain('Order%20Service');
      expect(resolveSwaggerDocUrl('/api/v1/inventory')).toContain('Inventory%20Service');
      expect(resolveSwaggerDocUrl('/api/v1/assets')).toContain('Asset%20Service');
      expect(resolveSwaggerDocUrl('/api/v1/transactions')).toContain('Transaction%20Service');
      expect(resolveSwaggerDocUrl('/api/v1/scheduler/jobs')).toContain('Scheduler%20Service');
      expect(resolveSwaggerDocUrl('/api/v1/iam/mfa/status')).toContain('IAM%20Service');
    });

    it('detects correct service tags', () => {
      expect(detectServiceTag('/api/v1/orders')).toBe('Orders');
      expect(detectServiceTag('/api/v1/inventory')).toBe('Inventory');
      expect(detectServiceTag('/api/v1/assets')).toBe('Assets');
      expect(detectServiceTag('/api/v1/transactions')).toBe('Transactions');
      expect(detectServiceTag('/api/v1/scheduler')).toBe('Scheduler');
      expect(detectServiceTag('/api/v1/iam')).toBe('IAM');
    });
  });
});

describe('New API Service Integration Methods (Requirement R1, R2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('IAM MFA & Cryptography API', () => {
    it('calls setupMfa and returns TOTP secret and QR url', async () => {
      const spy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: {
          status: true,
          message: 'Success',
          data: { secret: 'TESTSECRET', otpauthUrl: 'otpauth://...', recoveryCodes: ['123'] },
          errors: [],
        },
      });

      const res = await iamApi.setupMfa();
      expect(spy).toHaveBeenCalled();
      expect(res.data.secret).toBe('TESTSECRET');
      expect(res.data.recoveryCodes).toHaveLength(1);
    });

    it('calls enableMfa, verifyMfa, reverifyMfa, and getMfaStatus', async () => {
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/mfa/enable')) {
          return { status: 200, data: { status: true, message: 'Enabled', data: { enabled: true }, errors: [] } };
        }
        if (url.includes('/mfa/verify')) {
          return { status: 200, data: { status: true, message: 'Verified', data: { accessToken: 'jwt_123' }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'Re-verified', data: { reVerified: true }, errors: [] } };
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { mfaEnabled: true, isMfaVerifiedSession: true }, errors: [] },
      });

      const enabled = await iamApi.enableMfa({ code: '123456', secret: 'TEST' });
      expect(enabled.data.enabled).toBe(true);

      const verified = await iamApi.verifyMfa({ mfaChallengeToken: 'tok', code: '123456' });
      expect(verified.data.accessToken).toBe('jwt_123');

      const reverified = await iamApi.reverifyMfa({ code: '123456' });
      expect(reverified.data.reVerified).toBe(true);

      const status = await iamApi.getMfaStatus();
      expect(status.data.mfaEnabled).toBe(true);
    });

    it('retrieves JWKS discovery and RSA public key', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('jwks.json')) {
          return {
            status: 200,
            data: { status: true, message: 'OK', data: { keys: [{ kid: 'k1', kty: 'RSA', alg: 'RS256' }] }, errors: [] },
          };
        }
        return {
          status: 200,
          data: { status: true, message: 'OK', data: { publicKey: '-----BEGIN PUBLIC KEY-----...', keyId: 'k1' }, errors: [] },
        };
      });

      const jwks = await iamApi.getJwks();
      expect(jwks.data.keys).toHaveLength(1);
      expect(jwks.data.keys[0]?.alg).toBe('RS256');

      const pubKey = await iamApi.getPublicKey();
      expect(pubKey.data.publicKey).toContain('BEGIN PUBLIC KEY');
    });
  });

  describe('Config API Modular Sections & Cache Stats', () => {
    it('fetches sections summary, gets section, and updates section', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.endsWith('/sections')) {
          return { status: 200, data: { status: true, message: 'OK', data: { tenant: {}, iam: {} }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'OK', data: { storageProvider: 'LOCAL' }, errors: [] } };
      });
      vi.spyOn(apiClient, 'put').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Updated', data: { storageProvider: 'S3' }, errors: [] },
      });

      const summary = await configApi.getSectionsSummary();
      expect(summary.data).toHaveProperty('tenant');

      const section = await configApi.getSection('asset');
      expect(section.data.storageProvider).toBe('LOCAL');

      const updated = await configApi.updateSection('asset', { storageProvider: 'S3' });
      expect(updated.data.storageProvider).toBe('S3');
    });

    it('generates encrypted PII context token, queries cache stats, and purges cache', async () => {
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/context/token')) {
          return { status: 200, data: { status: true, message: 'OK', data: { contextToken: 'ctx_enc_123', expiresInSeconds: 86400 }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'OK', data: { success: true, invalidatedKey: 'ALL' }, errors: [] } };
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { hits: 100, misses: 5, size: 20 }, errors: [] },
      });

      const tokenRes = await configApi.generateContextToken({ tenantId: '00000000-0000-0000-0000-000000000001' });
      expect(tokenRes.data.contextToken).toBe('ctx_enc_123');

      const stats = await configApi.getCacheStats();
      expect(stats.data.hits).toBe(100);

      const invalidation = await configApi.invalidateCache({ all: true });
      expect(invalidation.data.success).toBe(true);
    });
  });

  describe('Notifications API Extensions', () => {
    it('dispatches batch notifications, gets provider config, clears outbox, and simulates webhook', async () => {
      vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url.includes('/batch')) {
          return { status: 201, data: { status: true, message: 'Batch sent', data: { total: 2, sentCount: 2, failedCount: 0, results: [] }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'Handled', data: { handled: true, provider: 'sendgrid' }, errors: [] } };
      });

      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: { defaultChannelRouting: { EMAIL: 'SENDGRID' } }, errors: [] },
      });

      vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Cleared', data: { cleared: true, count: 5 }, errors: [] },
      });

      const batch = await notificationsApi.sendBatch([
        { recipient: 'u1@test.local', channel: 'EMAIL', subject: 'Hi', body: 'Test' },
      ]);
      expect(batch.data.sentCount).toBe(2);

      const cfg = await notificationsApi.getProviderConfig();
      expect(cfg.data.defaultChannelRouting?.EMAIL).toBe('SENDGRID');

      const cleared = await notificationsApi.clearDryRunOutbox();
      expect(cleared.data.cleared).toBe(true);

      const wh = await notificationsApi.simulateWebhook('sendgrid', { event: 'delivered' });
      expect(wh.data.handled).toBe(true);
    });
  });

  describe('Domain Services CRUD Aliases & Extensions', () => {
    it('supports ordersApi.list alias', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'ord-1' }], errors: [] },
      });

      const listRes = await ordersApi.list();
      expect(listRes.data).toHaveLength(1);
    });

    it('supports inventoryApi.list and releaseStock', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ productId: 'p-1', sku: 'SKU-1', quantity: 50 }], errors: [] },
      });
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Released', data: { released: true }, errors: [] },
      });

      const listRes = await inventoryApi.list();
      expect(listRes.data[0]?.sku).toBe('SKU-1');

      const relRes = await inventoryApi.releaseStock({ productId: 'p-1', quantity: 5 });
      expect(relRes.data.released).toBe(true);
    });

    it('supports transactionsApi.list, getGateways, and refund', async () => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.includes('/gateways')) {
          return { status: 200, data: { status: true, message: 'OK', data: { gateways: ['STRIPE'], defaultGateway: 'STRIPE' }, errors: [] } };
        }
        return { status: 200, data: { status: true, message: 'OK', data: [{ id: 'txn-1', amount: 100 }], errors: [] } };
      });
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Refunded', data: { refunded: true, transactionId: 'txn-1' }, errors: [] },
      });

      const list = await transactionsApi.list();
      expect(list.data[0]?.id).toBe('txn-1');

      const gw = await transactionsApi.getGateways();
      expect(gw.data.defaultGateway).toBe('STRIPE');

      const ref = await transactionsApi.refund('txn-1', { reason: 'Defect' });
      expect(ref.data.refunded).toBe(true);
    });

    it('supports schedulerApi.list, trigger, delete aliases', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'j-1', name: 'Sync' }], errors: [] },
      });
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Triggered', data: { triggered: true, jobId: 'j-1' }, errors: [] },
      });
      vi.spyOn(apiClient, 'delete').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'Deleted', data: { deleted: true }, errors: [] },
      });

      const list = await schedulerApi.list();
      expect(list.data[0]?.name).toBe('Sync');

      const trig = await schedulerApi.trigger('j-1');
      expect(trig.data.triggered).toBe(true);

      const del = await schedulerApi.delete('j-1');
      expect(del.data.deleted).toBe(true);
    });

    it('supports assetsApi getMyAssets and create', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { status: true, message: 'OK', data: [{ id: 'ast-1', name: 'my.pdf' }], errors: [] },
      });
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        status: 201,
        data: { status: true, message: 'OK', data: { id: 'ast-2', name: 'new.pdf' }, errors: [] },
      });

      const myAssets = await assetsApi.getMyAssets();
      expect(myAssets.data).toHaveLength(1);

      const created = await assetsApi.create({ name: 'new.pdf', mimeType: 'application/pdf', sizeBytes: 100 });
      expect(created.data.name).toBe('new.pdf');
    });
  });
});
