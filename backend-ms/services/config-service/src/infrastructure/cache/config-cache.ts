export interface ConfigCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxEntries: number;
  ttlMs: number;
}

export class ConfigCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private ttlMs: number;
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(options?: ConfigCacheOptions) {
    this.ttlMs = options?.ttlMs ?? 60_000;
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU position (delete and re-insert at tail)
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, customTtlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const now = Date.now();
      // Pass 1: Prune expired entries
      for (const [k, v] of this.map.entries()) {
        if (now > v.expiresAt) {
          this.map.delete(k);
        }
      }
      // Pass 2: Evict oldest entry (LRU head) if still at or exceeding capacity
      while (this.map.size >= this.maxEntries) {
        const oldestKey = this.map.keys().next().value;
        if (oldestKey === undefined) break;
        this.map.delete(oldestKey);
      }
    }

    const ttl = customTtlMs ?? this.ttlMs;
    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  deleteMatching(predicate: (key: string) => boolean): number {
    let deleted = 0;
    for (const key of Array.from(this.map.keys())) {
      if (predicate(key)) {
        if (this.map.delete(key)) {
          deleted++;
        }
      }
    }
    return deleted;
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.map.size;
  }

  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.map.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs
    };
  }
}
