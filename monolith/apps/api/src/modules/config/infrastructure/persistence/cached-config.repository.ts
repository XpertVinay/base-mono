import { IConfigRepository } from '../../domain/repositories/config-repository.interface.js';
import { AppConfig, ConfigTarget } from '../../domain/entities/config.entity.js';
import { ConfigCache } from '../cache/config.cache.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class CachedConfigRepository implements IConfigRepository {
  constructor(
    private readonly persistentRepo: IConfigRepository,
    private readonly cache: ConfigCache = new ConfigCache()
  ) {}

  async findByKey(key: string, tenantId?: string): Promise<AppConfig | null> {
    const cacheKey = tenantId ? `TENANT_${tenantId.toUpperCase()}_${key}` : key;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const config = await this.persistentRepo.findByKey(key, tenantId);
    if (config) {
      this.cache.set(cacheKey, config);
    }
    return config;
  }

  async findAll(): Promise<AppConfig[]> {
    const cached = this.cache.getAll();
    if (cached) {
      return cached;
    }

    const configs = await this.persistentRepo.findAll();
    this.cache.setAll(configs);
    return configs;
  }

  async findByTarget(target: ConfigTarget): Promise<AppConfig[]> {
    const all = await this.findAll();
    return all.filter(c => c.target === target || c.target === 'ALL');
  }

  async save(config: AppConfig, tenantId?: string): Promise<void> {
    await this.persistentRepo.save(config, tenantId);
    // Write-through cache update
    const cacheKey = tenantId ? `TENANT_${tenantId.toUpperCase()}_${config.key}` : config.key;
    this.cache.set(cacheKey, config);
  }

  async findTenantSection(tenantId: string, section: string): Promise<Record<string, any> | null> {
    return this.persistentRepo.findTenantSection(tenantId, section);
  }

  async saveTenantSection(tenantId: string, section: string, data: Record<string, any>, isEncrypted?: boolean): Promise<void> {
    await this.persistentRepo.saveTenantSection(tenantId, section, data, isEncrypted);
  }

  async findAllTenantSections(tenantId: string): Promise<Record<string, Record<string, any>>> {
    return this.persistentRepo.findAllTenantSections(tenantId);
  }

  async warmup(): Promise<void> {
    try {
      const all = await this.persistentRepo.findAll();
      this.cache.setAll(all);
      logger.info('ConfigCache successfully warmed up with database configurations', {
        itemCount: all.length,
        keys: all.map(c => c.key)
      });
    } catch (err: any) {
      logger.warn('Failed to pre-warm config cache from DB, using fallback memory state', { error: err?.message });
    }
  }

  getCache(): ConfigCache {
    return this.cache;
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
