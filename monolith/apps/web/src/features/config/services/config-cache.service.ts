import { apiClient } from '../../../shared/api/api-client.js';

interface CachedStoragePayload {
  timestamp: number;
  ttl: number;
  data: Record<string, string>;
}

export type ConfigSubscriber = (configs: Record<string, string>) => void;

class ClientConfigCacheService {
  private memoryCache: Map<string, string> = new Map();
  private subscribers: Set<ConfigSubscriber> = new Set();
  private storageKey = 'monolith_client_configs_cache_v1';
  private defaultTtl = 10 * 60 * 1000; // 10 minutes client TTL
  private lastFetchedAt: number | null = null;
  private isFetching = false;
  private isInitialized = false;

  constructor() {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;

      const parsed: CachedStoragePayload = JSON.parse(raw);
      const isExpired = Date.now() - parsed.timestamp > (parsed.ttl || this.defaultTtl);

      // Hydrate memory cache immediately even if expired (stale-while-revalidate)
      if (parsed.data && typeof parsed.data === 'object') {
        Object.entries(parsed.data).forEach(([k, v]) => {
          this.memoryCache.set(k.toUpperCase().trim(), String(v));
        });
        this.lastFetchedAt = parsed.timestamp;
      }

      if (!isExpired) {
        this.isInitialized = true;
      }
    } catch {
      // Fallback gracefully on storage error
    }
  }

  private persistToStorage(data: Record<string, string>): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const payload: CachedStoragePayload = {
        timestamp: Date.now(),
        ttl: this.defaultTtl,
        data
      };
      localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }

  public async fetchConfigs(force = false): Promise<Record<string, string>> {
    // If not forced and already initialized with fresh cache, return memory cache
    if (!force && this.isInitialized && this.lastFetchedAt && (Date.now() - this.lastFetchedAt < this.defaultTtl)) {
      return this.getAll();
    }

    if (this.isFetching) {
      return this.getAll();
    }

    this.isFetching = true;
    try {
      const res = await apiClient.get<Record<string, string>>('/api/config/client');
      if (res.success && res.data) {
        this.memoryCache.clear();
        Object.entries(res.data).forEach(([k, v]) => {
          this.memoryCache.set(k.toUpperCase().trim(), String(v));
        });
        this.lastFetchedAt = Date.now();
        this.isInitialized = true;
        this.persistToStorage(res.data);
        this.notifySubscribers();
      }
    } catch (err) {
      // Retain memory/storage cached values on network fault
    } finally {
      this.isFetching = false;
    }

    return this.getAll();
  }

  public get(key: string, defaultValue = ''): string {
    const k = key.toUpperCase().trim();
    if (this.memoryCache.has(k)) {
      return this.memoryCache.get(k)!;
    }
    return defaultValue;
  }

  public getBoolean(key: string, defaultValue = false): boolean {
    const val = this.get(key);
    if (!val) return defaultValue;
    return val.toLowerCase() === 'true';
  }

  public getNumber(key: string, defaultValue = 0): number {
    const val = this.get(key);
    if (!val) return defaultValue;
    const parsed = Number(val);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  public getAll(): Record<string, string> {
    const obj: Record<string, string> = {};
    this.memoryCache.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }

  public updateLocal(key: string, value: string): void {
    const k = key.toUpperCase().trim();
    this.memoryCache.set(k, value);
    this.persistToStorage(this.getAll());
    this.notifySubscribers();
  }

  public invalidate(): void {
    this.memoryCache.clear();
    this.lastFetchedAt = null;
    this.isInitialized = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch {}
    }
    this.fetchConfigs(true);
  }

  public subscribe(cb: ConfigSubscriber): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notifySubscribers(): void {
    const all = this.getAll();
    this.subscribers.forEach(cb => cb(all));
  }

  public getStats(): {
    size: number;
    lastFetchedAt: string | null;
    isInitialized: boolean;
    isFetching: boolean;
  } {
    return {
      size: this.memoryCache.size,
      lastFetchedAt: this.lastFetchedAt ? new Date(this.lastFetchedAt).toISOString() : null,
      isInitialized: this.isInitialized,
      isFetching: this.isFetching
    };
  }
}

export const clientConfigCache = new ClientConfigCacheService();
