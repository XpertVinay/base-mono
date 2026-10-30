import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { container } from '../../bootstrap/container.js';
import { IConfigModulePublicApi, piiCryptoService } from '../../modules/config/index.js';

describe('Modular Sections Configuration & Swagger Documentation', () => {
  let app: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Register & Login Admin user
    const adminEmail = `admin-sections-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!',
        name: 'Sections Admin',
        role: 'ADMIN'
      });

    const adminLoginRes = await request(app)
      .post('/api/iam/login')
      .send({ email: adminEmail, password: 'AdminPassword123!' });
    adminToken = adminLoginRes.body.data.accessToken;

    // 2. Register & Login Standard user
    const userEmail = `user-sections-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({
        email: userEmail,
        password: 'UserPassword123!',
        name: 'Standard User',
        role: 'USER'
      });

    const userLoginRes = await request(app)
      .post('/api/iam/login')
      .send({ email: userEmail, password: 'UserPassword123!' });
    userToken = userLoginRes.body.data.accessToken;
  });

  describe('1. Modular Section RESTful Endpoints', () => {
    it('GET /api/config/sections returns consolidated configuration for all 11 modules when authorized', async () => {
      const res = await request(app)
        .get('/api/config/sections')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toHaveProperty('tenant');
      expect(data).toHaveProperty('iam');
      expect(data).toHaveProperty('white-label');
      expect(data).toHaveProperty('asset');
      expect(data).toHaveProperty('finance');
      expect(data).toHaveProperty('transaction');
      expect(data).toHaveProperty('inventory');
      expect(data).toHaveProperty('order');
      expect(data).toHaveProperty('property');
      expect(data).toHaveProperty('search');
      expect(data).toHaveProperty('scheduler');
    });

    it('1. Multi-Tenant Configuration: retrieves isolation mode and default tenant', async () => {
      const res = await request(app)
        .get('/api/config/sections/tenant')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.multiTenancyEnabled).toBe(true);
      expect(res.body.data.isolationMode).toBe('ROW_LEVEL');
      expect(res.body.data.headerKey).toBe('x-tenant-id');
    });

    it('2. IAM Configuration: retrieves RS256 asymmetric public key with private key REDACTED', async () => {
      const res = await request(app)
        .get('/api/config/sections/iam')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jwtAlgorithm).toBe('RS256');
      expect(res.body.data.jwtPublicKey).toContain('BEGIN PUBLIC KEY');
      // CRITICAL SECURITY ASSERTION: Private key must NEVER be leaked over API
      expect(res.body.data.jwtPrivateKey).toBe('[PROTECTED_ASYMMETRIC_KEY]');
      expect(res.body.data.maxLoginAttempts).toBe(5);
      expect(res.body.data.bcryptSaltRounds).toBe(10);
    });

    it('3. White-Label Configuration: retrieves branding, logos, and tenant overrides', async () => {
      const res = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.brandName).toBe('string');
      expect(res.body.data.brandName.length).toBeGreaterThan(0);
      expect(res.body.data.primaryColor).toBeDefined();
    });

    it('4. Asset Module Configuration: retrieves storage provider, size limits, and allowed MIME types', async () => {
      const res = await request(app)
        .get('/api/config/sections/asset')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storageProvider).toBe('LOCAL');
      expect(res.body.data.maxUploadSizeBytes).toBe(52428800);
      expect(res.body.data.allowedMimeTypes).toEqual(
        expect.arrayContaining(['image/jpeg', 'image/png', 'application/pdf'])
      );
    });

    it('5. Finance & Transaction Configuration: retrieves audit matrix, currency, and payment gateways with secrets redacted', async () => {
      const finRes = await request(app)
        .get('/api/config/sections/finance')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(finRes.status).toBe(200);
      expect(finRes.body.data.defaultCurrency).toBe('USD');
      expect(finRes.body.data.auditLoggingEnabled).toBe(true);
      expect(finRes.body.data.taxRatePercentage).toBe(18);

      const txnRes = await request(app)
        .get('/api/config/sections/transaction')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(txnRes.status).toBe(200);
      expect(['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK']).toContain(txnRes.body.data.activePaymentGateway);
      expect(txnRes.body.data.enabledGateways).toEqual(
        expect.arrayContaining(['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK'])
      );
      // CRITICAL SECURITY ASSERTION: Webhook secret must be redacted
      expect(txnRes.body.data.stripeWebhookSecret).toBe('[PROTECTED_WEBHOOK_SECRET]');
    });

    it('6. Inventory Configuration: retrieves stock tracking and service availability buffer', async () => {
      const res = await request(app)
        .get('/api/config/sections/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stockTrackingEnabled).toBe(true);
      expect(res.body.data.lowStockThreshold).toBe(10);
      expect(res.body.data.serviceAvailabilityBufferMinutes).toBe(30);
    });

    it('7. Order Module Configuration: retrieves confirmation mode and workflow stages', async () => {
      const res = await request(app)
        .get('/api/config/sections/order')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookingConfirmationMode).toBe('AUTO');
      expect(res.body.data.invoicePrefix).toBe('INV-');
      expect(res.body.data.defaultOrderStatusWorkflow).toEqual(
        expect.arrayContaining(['PENDING', 'CONFIRMED', 'COMPLETED'])
      );
    });

    it('8. Property Configuration: retrieves caretaking service operations and inspection cycles', async () => {
      const res = await request(app)
        .get('/api/config/sections/property')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.defaultInspectionIntervalDays).toBe(30);
      expect(res.body.data.caretakingServiceTypes).toEqual(
        expect.arrayContaining(['CLEANING', 'SECURITY_CHECK', 'GARDENING'])
      );
    });

    it('9. Search Configuration: retrieves search engine, index prefix, and fuzzy parameters', async () => {
      const res = await request(app)
        .get('/api/config/sections/search')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.searchEngine).toBe('POSTGRES_FTS');
      expect(res.body.data.elasticIndexPrefix).toBe('monolith_search');
      expect(res.body.data.fuzzinessLevel).toBe('AUTO');
    });

    it('10. Scheduler Configuration: retrieves cron concurrency and DLQ retention', async () => {
      const res = await request(app)
        .get('/api/config/sections/scheduler')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cronEngineEnabled).toBe(true);
      expect(res.body.data.maxConcurrentJobs).toBe(10);
      expect(res.body.data.deadLetterQueueRetentionDays).toBe(14);
    });
  });

  describe('2. Security Verification & Role-Based Access Control', () => {
    it('rejects unauthenticated requests to /api/config/sections with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/config/sections');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects unauthenticated requests to /api/config/sections/:section with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/config/sections/iam');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-admin users from viewing section configurations with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/config/sections')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-admin users from updating section configurations (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ brandName: 'Hacked Brand' });

      expect(res.status).toBe(403);
    });

    it('rejects predictable slug or non-UUID tenantId with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/config/sections/white-label?tenantId=predictable-tenant-slug')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('UUID');
    });

    it('rejects predictable slug on PUT with 400 Bad Request', async () => {
      const res = await request(app)
        .put('/api/config/sections/white-label?tenantId=slug-based-tenant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ brandName: 'Hacked Slug Brand' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('UUID');
    });

    it('allows Admin to update section configuration with instant cache reflection', async () => {
      const updateRes = await request(app)
        .put('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          brandName: 'Global Estate Care Enterprise',
          primaryColor: '#8b5cf6'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.brandName).toBe('Global Estate Care Enterprise');
      expect(updateRes.body.data.primaryColor).toBe('#8b5cf6');

      // Verify subsequent GET returns updated values
      const getRes = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.body.data.brandName).toBe('Global Estate Care Enterprise');
      expect(getRes.body.data.primaryColor).toBe('#8b5cf6');
    });

    it('supports tenant-scoped configuration overrides using valid RFC 4122 UUID', async () => {
      const tenantUuid = 'a0000000-0000-4000-8000-000000000001';

      // Set custom brand for prestige tenant UUID
      const updateRes = await request(app)
        .put(`/api/config/sections/white-label?tenantId=${tenantUuid}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          brandName: 'Prestige Luxury Estates',
          primaryColor: '#d97706'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.brandName).toBe('Prestige Luxury Estates');

      // Query with tenant UUID returns tenant override
      const tenantGetRes = await request(app)
        .get(`/api/config/sections/white-label?tenantId=${tenantUuid}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(tenantGetRes.body.data.brandName).toBe('Prestige Luxury Estates');
      expect(tenantGetRes.body.data.primaryColor).toBe('#d97706');

      // Query without tenantId returns global configuration
      const globalGetRes = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(globalGetRes.body.data.brandName).toBe('Global Estate Care Enterprise');
    });
  });

  describe('3. IConfigModulePublicApi Clean Architecture Ingestion', () => {
    it('allows other business modules to resolve their strongly-typed section configuration via publicApi', async () => {
      const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');

      // Tenant module consuming tenant config
      const tenantConfig = await configApi.getTenantConfig();
      expect(tenantConfig.multiTenancyEnabled).toBe(true);

      // IAM module consuming asymmetric keys
      const iamConfig = await configApi.getIamConfig();
      expect(iamConfig.jwtAlgorithm).toBe('RS256');

      // Asset module consuming storage provider & limits
      const assetConfig = await configApi.getAssetConfig();
      expect(assetConfig.storageProvider).toBe('LOCAL');

      // Finance consuming audit matrix & currency
      const financeConfig = await configApi.getFinanceConfig();
      expect(financeConfig.defaultCurrency).toBe('USD');

      // Inventory consuming availability rules
      const inventoryConfig = await configApi.getInventoryConfig();
      expect(inventoryConfig.stockTrackingEnabled).toBe(true);

      // Order consuming workflow rules
      const orderConfig = await configApi.getOrderConfig();
      expect(orderConfig.invoicePrefix).toBe('INV-');

      // Generic section getter
      const searchConfig = await configApi.getSectionConfig('search');
      expect(searchConfig.searchEngine).toBe('POSTGRES_FTS');
    });
  });

  describe('4. Interactive Swagger Documentation', () => {
    it('exposes OpenAPI specification at /api-docs/swagger.json with configuration tags, paths, and schemas', async () => {
      const res = await request(app).get('/api-docs/swagger.json');

      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');

      // Verify Tags
      const tagNames = res.body.tags.map((t: any) => t.name);
      expect(tagNames).toContain('Configuration - Modular Sections');
      expect(tagNames).toContain('Configuration - Core & Caching');

      // Verify Paths
      expect(res.body.paths).toHaveProperty('/api/config/sections');
      expect(res.body.paths).toHaveProperty('/api/config/sections/{section}');
      expect(res.body.paths).toHaveProperty('/api/config/client');
      expect(res.body.paths).toHaveProperty('/api/config/cache/stats');
      expect(res.body.paths).toHaveProperty('/api/config/cache/invalidate');
      expect(res.body.paths).toHaveProperty('/api/config');
      expect(res.body.paths).toHaveProperty('/api/config/{key}');

      // Verify Schemas
      const schemas = res.body.components.schemas;
      expect(schemas).toHaveProperty('TenantConfig');
      expect(schemas).toHaveProperty('IamConfig');
      expect(schemas).toHaveProperty('WhiteLabelConfig');
      expect(schemas).toHaveProperty('AssetConfig');
      expect(schemas).toHaveProperty('FinanceConfig');
      expect(schemas).toHaveProperty('TransactionConfig');
      expect(schemas).toHaveProperty('InventoryConfig');
      expect(schemas).toHaveProperty('OrderConfig');
      expect(schemas).toHaveProperty('PropertyConfig');
      expect(schemas).toHaveProperty('SearchConfig');
      expect(schemas).toHaveProperty('SchedulerConfig');
      expect(schemas).toHaveProperty('AllSectionsSummary');
    });
  });

  describe('5. Database-Driven Multi-Tenant Onboarding & Encrypted PII Protection', () => {
    const onboardingTenantId = 'b1000000-0000-4000-8000-000000000002';

    it('issues encrypted PII tenant context token via POST /api/config/context/token', async () => {
      const res = await request(app)
        .post('/api/config/context/token')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tenantId: onboardingTenantId,
          orgId: 'org-luxury-residences',
          ttlMs: 3600000
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('contextToken');
      expect(res.body.data.contextToken.startsWith('v1.')).toBe(true);
      expect(res.body.data.tenantId).toBe(onboardingTenantId);

      // Verify token is decryptable by backend piiCryptoService
      const decrypted = piiCryptoService.decryptPiiContext(res.body.data.contextToken);
      expect(decrypted.tenantId).toBe(onboardingTenantId);
      expect(decrypted.orgId).toBe('org-luxury-residences');
    });

    it('onboards a new tenant with custom database-driven configuration without any code changes', async () => {
      // 1. Onboard custom finance and white-label configurations directly into database for onboarding tenant
      const updateRes = await request(app)
        .put(`/api/config/sections/finance?tenantId=${onboardingTenantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          defaultCurrency: 'EUR',
          taxRatePercentage: 21,
          auditLoggingEnabled: true
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.defaultCurrency).toBe('EUR');
      expect(updateRes.body.data.taxRatePercentage).toBe(21);

      // 2. Custom white-label branding for onboarding tenant
      await request(app)
        .put(`/api/config/sections/white-label?tenantId=${onboardingTenantId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          brandName: 'DB Driven European Residences',
          primaryColor: '#059669'
        });

      // 3. Query via publicApi for this tenant - returns tenant-specific DB overrides
      const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');
      const tenantFinance = await configApi.getFinanceConfig(onboardingTenantId);
      expect(tenantFinance.defaultCurrency).toBe('EUR');
      expect(tenantFinance.taxRatePercentage).toBe(21);

      const tenantBranding = await configApi.getWhiteLabelConfig(onboardingTenantId);
      expect(tenantBranding.brandName).toBe('DB Driven European Residences');
      expect(tenantBranding.primaryColor).toBe('#059669');

      // 4. Verify global default remains unaffected
      const globalFinance = await configApi.getFinanceConfig();
      expect(globalFinance.defaultCurrency).toBe('USD');
    });

    it('resolves tenant configuration using encrypted PII context header (no plaintext tenantId on the wire)', async () => {
      // Generate encrypted PII context token
      const contextToken = piiCryptoService.encryptPiiContext({
        tenantId: onboardingTenantId,
        userId: 'usr_secure_pii_123',
        email: 'ceo@europeanresidences.local',
        orgId: 'org_eur_01'
      });

      // Pass encrypted context via x-tenant-context header with NO tenantId query param!
      const res = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-context', contextToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandName).toBe('DB Driven European Residences');
      expect(res.body.data.primaryColor).toBe('#059669');
    });

    it('rejects tampered encrypted context tokens (preventing token manipulation/forgery)', async () => {
      const validToken = piiCryptoService.encryptPiiContext({
        tenantId: onboardingTenantId,
        userId: 'usr_1'
      });

      // Tamper with ciphertext by altering last characters
      const tamperedToken = validToken.slice(0, -4) + 'abcd';

      const res = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-context', tamperedToken);

      // Must be rejected with 401 Unauthorized or 400 Bad Request
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('rejects expired encrypted context tokens (replay attack protection)', async () => {
      // Create a token expired 1 second ago
      const expiredToken = piiCryptoService.encryptPiiContext({
        tenantId: onboardingTenantId,
        ttlMs: -1000
      });

      const res = await request(app)
        .get('/api/config/sections/white-label')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-tenant-context', expiredToken);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('protects sensitive configurations at rest using AES-256-GCM encryption in PostgreSQL', () => {
      const rawSecret = 'sk_live_very_confidential_stripe_secret_key_999';
      const encryptedAtRest = piiCryptoService.encryptAtRest(rawSecret);

      expect(encryptedAtRest.startsWith('enc:v1.')).toBe(true);
      expect(encryptedAtRest).not.toContain(rawSecret);

      const decrypted = piiCryptoService.decryptAtRest(encryptedAtRest);
      expect(decrypted).toBe(rawSecret);
    });
  });
});
