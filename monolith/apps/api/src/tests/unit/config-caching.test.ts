import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { ConfigCache } from '../../modules/config/infrastructure/cache/config.cache.js';
import { CachedConfigRepository } from '../../modules/config/infrastructure/persistence/cached-config.repository.js';
import { PostgresConfigRepository } from '../../modules/config/infrastructure/persistence/postgres-config.repository.js';
import { AppConfig } from '../../modules/config/domain/entities/config.entity.js';
import { container } from '../../bootstrap/container.js';
import { IConfigModulePublicApi } from '../../modules/config/index.js';

describe('Config Module Multi-Tier Database & In-Memory Caching', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();

    // Register & Login Admin user
    const adminEmail = `config-admin-${Date.now()}@monolith.local`;
    await request(app)
      .post('/api/iam/register')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!',
        name: 'Config Cache Admin',
        role: 'ADMIN'
      });

    const loginRes = await request(app)
      .post('/api/iam/login')
      .send({
        email: adminEmail,
        password: 'AdminPassword123!'
      });

    adminToken = loginRes.body.data.accessToken;
  });

  describe('1. ConfigCache Low-Level Engine', () => {
    it('stores and retrieves cached items with hit/miss counting', () => {
      const cache = new ConfigCache(1000);
      const config = AppConfig.create('TEST_KEY', 'test_val', 'desc', false, 'ALL');

      expect(cache.get('TEST_KEY')).toBeNull();
      expect(cache.getStats().misses).toBe(1);
      expect(cache.getStats().hits).toBe(0);

      cache.set('TEST_KEY', config);
      const retrieved = cache.get('TEST_KEY');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.value).toBe('test_val');
      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().size).toBe(1);
    });

    it('expires cache entry after TTL', async () => {
      const cache = new ConfigCache(30); // 30ms TTL
      const config = AppConfig.create('SHORT_LIVED', 'foo');
      cache.set('SHORT_LIVED', config);

      expect(cache.get('SHORT_LIVED')?.value).toBe('foo');

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(cache.get('SHORT_LIVED')).toBeNull();
    });

    it('invalidates individual keys and clears all cache', () => {
      const cache = new ConfigCache();
      cache.set('KEY_A', AppConfig.create('KEY_A', '1'));
      cache.set('KEY_B', AppConfig.create('KEY_B', '2'));

      expect(cache.getStats().size).toBe(2);
      cache.delete('KEY_A');
      expect(cache.get('KEY_A')).toBeNull();
      expect(cache.get('KEY_B')?.value).toBe('2');

      cache.clear();
      expect(cache.getStats().size).toBe(0);
      expect(cache.get('KEY_B')).toBeNull();
    });
  });

  describe('2. CachedConfigRepository Decorator & Pre-warming', () => {
    it('pre-warms cache and serves subsequent queries from memory', async () => {
      const persistentRepo = new PostgresConfigRepository();
      const cache = new ConfigCache();
      const cachedRepo = new CachedConfigRepository(persistentRepo, cache);

      await cachedRepo.warmup();
      expect(cache.getStats().size).toBeGreaterThan(0);

      const activeGw = await cachedRepo.findByKey('ACTIVE_PAYMENT_GATEWAY');
      expect(activeGw).not.toBeNull();
      expect(cache.getStats().hits).toBeGreaterThan(0);
    });

    it('filters configurations by target (FRONTEND, BACKEND, ALL)', async () => {
      const persistentRepo = new PostgresConfigRepository();
      const cachedRepo = new CachedConfigRepository(persistentRepo);

      const feConfigs = await cachedRepo.findByTarget('FRONTEND');
      expect(feConfigs.every(c => c.target === 'FRONTEND' || c.target === 'ALL')).toBe(true);

      const beConfigs = await cachedRepo.findByTarget('BACKEND');
      expect(beConfigs.every(c => c.target === 'BACKEND' || c.target === 'ALL')).toBe(true);
    });
  });

  describe('3. IConfigModulePublicApi Public Service Contract', () => {
    it('provides synchronous in-memory read and typed getters', async () => {
      const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');

      const gateway = await configApi.get('ACTIVE_PAYMENT_GATEWAY', 'MOCK');
      expect(['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK']).toContain(gateway);

      const isMaintenance = await configApi.getBoolean('SYSTEM_MAINTENANCE_MODE', false);
      expect(typeof isMaintenance).toBe('boolean');

      const maxAttempts = await configApi.getNumber('MAX_LOGIN_ATTEMPTS', 3);
      expect(maxAttempts).toBe(5);

      // Fast synchronous lookup
      const cached = configApi.getCached('ACTIVE_PAYMENT_GATEWAY');
      expect(cached).toBeDefined();
    });
  });

  describe('4. HTTP Endpoints for BE/FE Caching & Synchronization', () => {
    it('serves client configurations at GET /api/config/client with cache headers', async () => {
      const res = await request(app).get('/api/config/client');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect(res.body.data).toHaveProperty('ACTIVE_PAYMENT_GATEWAY');
      expect(res.body.data).toHaveProperty('FEATURE_NEW_CHECKOUT');
      expect(res.body.data).not.toHaveProperty('MAX_LOGIN_ATTEMPTS'); // Backend only!
    });

    it('allows Admin to inspect BE cache statistics at GET /api/config/cache/stats', async () => {
      const res = await request(app)
        .get('/api/config/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('hits');
      expect(res.body.data).toHaveProperty('misses');
      expect(res.body.data).toHaveProperty('size');
      expect(res.body.data).toHaveProperty('hitRatio');
    });

    it('updates config, updates target, and write-through cache', async () => {
      const setRes = await request(app)
        .post('/api/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'FE_BANNER_TEXT',
          value: 'Welcome to Real Estate CareTaking',
          description: 'Homepage promotional banner',
          target: 'FRONTEND'
        });

      expect(setRes.status).toBe(200);
      expect(setRes.body.success).toBe(true);
      expect(setRes.body.data.target).toBe('FRONTEND');

      // Check client endpoint receives it
      const clientRes = await request(app).get('/api/config/client');
      expect(clientRes.body.data['FE_BANNER_TEXT']).toBe('Welcome to Real Estate CareTaking');

      // Purge cache endpoint works
      const purgeRes = await request(app)
        .post('/api/config/cache/invalidate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'FE_BANNER_TEXT' });

      expect(purgeRes.status).toBe(200);
      expect(purgeRes.body.success).toBe(true);
    });
  });
});
