import { AppConfig } from '../../domain/entities/config.entity.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ConfigCache {
  private cache: Map<string, CacheEntry<AppConfig>> = new Map();
  private allConfigsCache: CacheEntry<AppConfig[]> | null = null;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private lastWarmedAt: Date | null = null;

  constructor(defaultTtlMs = 10 * 60 * 1000) { // 10 minutes default TTL
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: string): AppConfig | null {
    const normalizedKey = key.toUpperCase().trim();
    const entry = this.cache.get(normalizedKey);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(normalizedKey);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  set(key: string, config: AppConfig, ttlMs?: number): void {
    const normalizedKey = key.toUpperCase().trim();
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(normalizedKey, { data: config, expiresAt });
    // Invalidate full collection cache whenever single item is updated
    this.allConfigsCache = null;
  }

  delete(key: string): void {
    const normalizedKey = key.toUpperCase().trim();
    this.cache.delete(normalizedKey);
    this.allConfigsCache = null;
  }

  clear(): void {
    this.cache.clear();
    this.allConfigsCache = null;
  }

  getAll(): AppConfig[] | null {
    if (!this.allConfigsCache) {
      return null;
    }
    if (Date.now() > this.allConfigsCache.expiresAt) {
      this.allConfigsCache = null;
      return null;
    }
    this.hits++;
    return this.allConfigsCache.data;
  }

  setAll(configs: AppConfig[], ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.allConfigsCache = { data: configs, expiresAt };
    for (const cfg of configs) {
      this.cache.set(cfg.key, { data: cfg, expiresAt });
    }
    this.lastWarmedAt = new Date();
  }

  markWarmed(): void {
    this.lastWarmedAt = new Date();
  }

  getStats(): {
    hits: number;
    misses: number;
    size: number;
    hitRatio: number;
    lastWarmedAt: string | null;
  } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(3)) : 0,
      lastWarmedAt: this.lastWarmedAt ? this.lastWarmedAt.toISOString() : null
    };
  }
}
