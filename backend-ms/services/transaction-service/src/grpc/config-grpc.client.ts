import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../shared/infrastructure/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export interface ConfigGrpcClientOptions {
  ttlMs?: number;
  maxEntries?: number;
  callDeadlineMs?: number;
}

export class ConfigGrpcClient {
  private client: any;
  private cache = new Map<string, CacheEntry>();
  private lastKnownGood = new Map<string, string>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly callDeadlineMs: number;
  private hits = 0;
  private misses = 0;

  constructor(
    targetUrl: string = process.env.CONFIG_GRPC_URL || 'localhost:50053',
    customClient?: any,
    options?: ConfigGrpcClientOptions
  ) {
    this.ttlMs = options?.ttlMs ?? 60_000;
    this.maxEntries = options?.maxEntries ?? 1000;
    this.callDeadlineMs = options?.callDeadlineMs ?? 2500;

    if (customClient) {
      this.client = customClient;
    } else {
      const protoPath = path.resolve(__dirname, '../proto/config.proto');
      const packageDef = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
      const descriptor = grpc.loadPackageDefinition(packageDef) as any;
      this.client = new descriptor.config.ConfigService(
        targetUrl,
        grpc.credentials.createInsecure()
      );
    }
  }

  private getCached(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  private setCached(key: string, value: string, customTtlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now > v.expiresAt) {
          this.cache.delete(k);
        }
      }
      while (this.cache.size >= this.maxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest === undefined) break;
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (customTtlMs ?? this.ttlMs)
    });
  }

  async getActiveGateway(tenantId?: string): Promise<string> {
    const tid = tenantId || 'default';
    const cacheKey = `${tid}:ACTIVE_PAYMENT_GATEWAY`;

    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    return new Promise((resolve) => {
      const metadata = new grpc.Metadata();
      metadata.add('x-tenant-id', tid);

      const deadline = new Date(Date.now() + this.callDeadlineMs);

      this.client.GetActivePaymentGateway(
        {},
        metadata,
        { deadline },
        (err: any, response: any) => {
          const provider = response?.data?.provider ?? response?.provider;

          if (err || !provider) {
            logger.warn('gRPC GetActivePaymentGateway failed, checking last-known-good fallback', {
              tenantId: tid,
              err: err?.message
            });

            // Resilient fallback: Check last-known-good for this tenant
            const fallbackProvider = this.lastKnownGood.get(tid);
            if (fallbackProvider) {
              logger.info('Using last-known-good payment gateway fallback', {
                tenantId: tid,
                provider: fallbackProvider
              });
              // Cache resilient fallback for 10s to avoid hammering dead config-service
              this.setCached(cacheKey, fallbackProvider, 10_000);
              return resolve(fallbackProvider);
            }

            const defaultFallback = process.env.DEFAULT_PAYMENT_GATEWAY || 'STRIPE';
            logger.info('Falling back to default environment gateway', {
              tenantId: tid,
              provider: defaultFallback
            });
            return resolve(defaultFallback);
          }

          // Store successful resolution in both LRU cache and last-known-good map
          this.lastKnownGood.set(tid, provider);
          this.setCached(cacheKey, provider);
          resolve(provider);
        }
      );
    });
  }

  async getConfigByKey(key: string, tenantId?: string, defaultValue?: string): Promise<string | null> {
    const tid = tenantId || 'default';
    const cacheKey = `${tid}:${key}`;

    const cached = this.getCached(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    return new Promise((resolve) => {
      const metadata = new grpc.Metadata();
      metadata.add('x-tenant-id', tid);

      const deadline = new Date(Date.now() + this.callDeadlineMs);

      this.client.GetConfigByKey(
        { key, defaultValue: defaultValue || '' },
        metadata,
        { deadline },
        (err: any, response: any) => {
          if (err || !response?.status) {
            logger.warn('gRPC GetConfigByKey failed', { key, tenantId: tid, err: err?.message });
            return resolve(defaultValue ?? null);
          }

          const val = response?.data?.value ?? response?.value ?? defaultValue ?? null;
          if (val !== null) {
            this.setCached(cacheKey, val);
          }
          resolve(val);
        }
      );
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.lastKnownGood.clear();
    this.hits = 0;
    this.misses = 0;
  }

  invalidate(tenantId?: string, key?: string): void {
    const tid = tenantId || 'default';
    if (key) {
      this.cache.delete(`${tid}:${key}`);
    } else {
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(`${tid}:`)) {
          this.cache.delete(k);
        }
      }
      this.lastKnownGood.delete(tid);
    }
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      lastKnownGoodCount: this.lastKnownGood.size
    };
  }
}
