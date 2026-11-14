import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { ConfigSetting } from '../../domain/entities/config.entity.js';
import { ConfigCache } from '../cache/config-cache.js';

export class CachedConfigRepository implements IConfigRepository {
  constructor(
    private readonly inner: IConfigRepository,
    private readonly cache: ConfigCache<ConfigSetting | null> = new ConfigCache<ConfigSetting | null>({
      ttlMs: 60_000,
      maxEntries: 1000
    })
  ) {}

  private cacheKey(key: string, tenantId?: string): string {
    const tid = tenantId || 'default';
    return `${tid}:${key}`;
  }

  async getByKey(key: string, tenantId?: string): Promise<ConfigSetting | null> {
    const k = this.cacheKey(key, tenantId);
    const cached = this.cache.get(k);
    if (cached !== undefined) {
      return cached;
    }

    const setting = await this.inner.getByKey(key, tenantId);
    // Negative caching: cache null if not found
    this.cache.set(k, setting);
    return setting;
  }

  async getAll(tenantId?: string): Promise<ConfigSetting[]> {
    return this.inner.getAll(tenantId);
  }

  async save(setting: ConfigSetting): Promise<void> {
    await this.inner.save(setting);
    const tid = setting.tenantId || 'default';
    if (tid === 'default') {
      // Invalidate all tenant entries for this key to maintain inheritance consistency
      this.cache.deleteMatching((k) => k.endsWith(':' + setting.key));
    } else {
      this.cache.delete(`${tid}:${setting.key}`);
    }
  }

  async delete(key: string, tenantId?: string): Promise<boolean> {
    const deleted = await this.inner.delete(key, tenantId);
    const tid = tenantId || 'default';
    if (tid === 'default') {
      // Invalidate all tenant entries for this key to maintain inheritance consistency
      this.cache.deleteMatching((k) => k.endsWith(':' + key));
    } else {
      this.cache.delete(`${tid}:${key}`);
    }
    return deleted;
  }

  getCache(): ConfigCache<ConfigSetting | null> {
    return this.cache;
  }
}
