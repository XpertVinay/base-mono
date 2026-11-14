import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigCache } from '../src/infrastructure/cache/config-cache.js';
import { CachedConfigRepository } from '../src/infrastructure/persistence/cached-config.repository.js';
import { ConfigSetting } from '../src/domain/entities/config.entity.js';
import { IConfigRepository } from '../src/domain/repositories/config-repository.interface.js';

class MockConfigRepo implements IConfigRepository {
  public store = new Map<string, ConfigSetting>();
  public getByKeyCallCount = 0;
  public saveCallCount = 0;
  public deleteCallCount = 0;

  private k(key: string, tenantId?: string): string {
    return `${tenantId || 'default'}:${key}`;
  }

  async getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null> {
    this.getByKeyCallCount++;
    const tid = tenantId || 'default';
    const specific = this.store.get(this.k(key, tid));
    if (specific) return specific;

    if (tid !== 'default') {
      const def = this.store.get(this.k(key, 'default'));
      if (def) return def;
    }
    return null;
  }

  async getAll(tenantId?: string): Promise<ConfigSetting[]> {
    return Array.from(this.store.values()).filter(
      (s) => s.tenantId === (tenantId || 'default') || s.tenantId === 'default'
    );
  }

  async save(setting: ConfigSetting): Promise<void> {
    this.saveCallCount++;
    this.store.set(this.k(setting.key, setting.tenantId), setting);
  }

  async delete(key: string, tenantId?: string): Promise<boolean> {
    this.deleteCallCount++;
    return this.store.delete(this.k(key, tenantId));
  }
}

test('ConfigCache: LRU and TTL unit behavior', async (t) => {
  await t.test('LRU eviction when maxEntries reached', () => {
    const cache = new ConfigCache<string>({ maxEntries: 3, ttlMs: 10000 });
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k3', 'v3');

    // Access k1 so k2 becomes the least recently used
    assert.equal(cache.get('k1'), 'v1');

    // Add k4; k2 should be evicted
    cache.set('k4', 'v4');

    assert.equal(cache.get('k1'), 'v1');
    assert.equal(cache.get('k2'), undefined);
    assert.equal(cache.get('k3'), 'v3');
    assert.equal(cache.get('k4'), 'v4');
    assert.equal(cache.size(), 3);
  });

  await t.test('TTL expiration', async () => {
    const cache = new ConfigCache<string>({ maxEntries: 10, ttlMs: 30 });
    cache.set('temp', 'val');
    assert.equal(cache.get('temp'), 'val');

    await new Promise((r) => setTimeout(r, 45));
    assert.equal(cache.get('temp'), undefined);
  });

  await t.test('deleteMatching removes all matching keys', () => {
    const cache = new ConfigCache<string>({ maxEntries: 10, ttlMs: 10000 });
    cache.set('tenant1:PAYMENT_GATEWAY', 'STRIPE');
    cache.set('tenant2:PAYMENT_GATEWAY', 'PAYPAL');
    cache.set('tenant1:APP_NAME', 'MyApp');

    const count = cache.deleteMatching((k) => k.endsWith(':PAYMENT_GATEWAY'));
    assert.equal(count, 2);
    assert.equal(cache.get('tenant1:PAYMENT_GATEWAY'), undefined);
    assert.equal(cache.get('tenant2:PAYMENT_GATEWAY'), undefined);
    assert.equal(cache.get('tenant1:APP_NAME'), 'MyApp');
  });
});

test('CachedConfigRepository: high-frequency read caching and invalidation', async (t) => {
  await t.test('Duplicate reads hit in-memory cache without hitting database repository', async () => {
    const mock = new MockConfigRepo();
    mock.store.set('default:SITE_NAME', ConfigSetting.create('SITE_NAME', { tenantId: 'default', value: 'Enterprise' }));
    const cachedRepo = new CachedConfigRepository(mock);

    // First read -> miss, hits mock
    const res1 = await cachedRepo.getByKey('SITE_NAME', 'default');
    assert.equal(res1?.value, 'Enterprise');
    assert.equal(mock.getByKeyCallCount, 1);

    // Second read -> hit, does not increment mock count
    const res2 = await cachedRepo.getByKey('SITE_NAME', 'default');
    assert.equal(res2?.value, 'Enterprise');
    assert.equal(mock.getByKeyCallCount, 1);

    const stats = cachedRepo.getCache().getStats();
    assert.equal(stats.hits, 1);
    assert.equal(stats.misses, 1);
  });

  await t.test('Negative caching: missing key is cached and does not hit DB repeatedly', async () => {
    const mock = new MockConfigRepo();
    const cachedRepo = new CachedConfigRepository(mock);

    const res1 = await cachedRepo.getByKey('NON_EXISTENT', 'default');
    assert.equal(res1, null);
    assert.equal(mock.getByKeyCallCount, 1);

    const res2 = await cachedRepo.getByKey('NON_EXISTENT', 'default');
    assert.equal(res2, null);
    assert.equal(mock.getByKeyCallCount, 1);

    // Now save this key -> should invalidate negative cache entry
    await cachedRepo.save(ConfigSetting.create('NON_EXISTENT', { tenantId: 'default', value: 'NowCreated' }));
    const res3 = await cachedRepo.getByKey('NON_EXISTENT', 'default');
    assert.equal(res3?.value, 'NowCreated');
    assert.equal(mock.getByKeyCallCount, 2);
  });

  await t.test('Default mutation invalidates inherited cache entries across all tenants', async () => {
    const mock = new MockConfigRepo();
    mock.store.set('default:ACTIVE_PAYMENT_GATEWAY', ConfigSetting.create('ACTIVE_PAYMENT_GATEWAY', { tenantId: 'default', value: 'STRIPE' }));
    const cachedRepo = new CachedConfigRepository(mock);

    // Tenant A and Tenant B both read inherited default
    const a1 = await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-a');
    const b1 = await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-b');
    assert.equal(a1?.value, 'STRIPE');
    assert.equal(b1?.value, 'STRIPE');
    assert.equal(mock.getByKeyCallCount, 2);

    // Cached now
    await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-a');
    await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-b');
    assert.equal(mock.getByKeyCallCount, 2);

    // Mutate default setting to PAYPAL
    await cachedRepo.save(ConfigSetting.create('ACTIVE_PAYMENT_GATEWAY', { tenantId: 'default', value: 'PAYPAL' }));

    // Both tenants should now query repo and receive PAYPAL
    const a2 = await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-a');
    const b2 = await cachedRepo.getByKey('ACTIVE_PAYMENT_GATEWAY', 'tenant-b');
    assert.equal(a2?.value, 'PAYPAL');
    assert.equal(b2?.value, 'PAYPAL');
    assert.equal(mock.getByKeyCallCount, 4);
  });

  await t.test('Tenant-specific override invalidates only that tenant cache', async () => {
    const mock = new MockConfigRepo();
    mock.store.set('default:THEME', ConfigSetting.create('THEME', { tenantId: 'default', value: 'light' }));
    const cachedRepo = new CachedConfigRepository(mock);

    await cachedRepo.getByKey('THEME', 'tenant-a');
    await cachedRepo.getByKey('THEME', 'tenant-b');
    assert.equal(mock.getByKeyCallCount, 2);

    // Save override only for tenant-a
    await cachedRepo.save(ConfigSetting.create('THEME', { tenantId: 'tenant-a', value: 'dark' }));

    // Read tenant-a: should re-query and return dark
    const a = await cachedRepo.getByKey('THEME', 'tenant-a');
    assert.equal(a?.value, 'dark');
    assert.equal(mock.getByKeyCallCount, 3);

    // Read tenant-b: should still hit cache (call count remains 3)
    const b = await cachedRepo.getByKey('THEME', 'tenant-b');
    assert.equal(b?.value, 'light');
    assert.equal(mock.getByKeyCallCount, 3);
  });

  await t.test('Delete operation invalidates cache', async () => {
    const mock = new MockConfigRepo();
    mock.store.set('tenant-x:FEATURE_FLAG', ConfigSetting.create('FEATURE_FLAG', { tenantId: 'tenant-x', value: 'true' }));
    const cachedRepo = new CachedConfigRepository(mock);

    const f1 = await cachedRepo.getByKey('FEATURE_FLAG', 'tenant-x');
    assert.equal(f1?.value, 'true');
    assert.equal(mock.getByKeyCallCount, 1);

    await cachedRepo.delete('FEATURE_FLAG', 'tenant-x');

    const f2 = await cachedRepo.getByKey('FEATURE_FLAG', 'tenant-x');
    assert.equal(f2, null);
    assert.equal(mock.getByKeyCallCount, 2);
  });
});
