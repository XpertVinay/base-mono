import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export interface RateLimitViolationInfo {
  ip: string;
  key?: string;
  count: number;
  max: number;
  windowMs: number;
  firstViolationInWindow: boolean;
}

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  maxEntries?: number;
  keyGenerator?: (req: Request) => string;
  onLimitExceeded?: (req: Request, info: RateLimitViolationInfo) => void;
}

function defaultKeyGenerator(req: Request): string {
  const user = (req as any).user;
  const userId = user?.id || (req.header('x-user-id') as string | undefined);
  if (userId) {
    const tenantId =
      user?.tenantId ||
      (req as any).tenant?.tenantId ||
      (req.header('x-tenant-id') as string | undefined) ||
      'default';
    return `${tenantId}:${userId}`;
  }
  return (req.ip || req.socket?.remoteAddress || 'unknown') as string;
}

export function rateLimiter(options?: RateLimiterOptions) {
  const windowMs = options?.windowMs || 60000;
  const max = options?.max || 120;
  const message = options?.message || 'Too many requests, please try again later.';
  const maxEntries = options?.maxEntries || 10000;
  const keyGen = options?.keyGenerator || defaultKeyGenerator;
  const store = new Map<string, RateLimitStore>();

  // Prune expired entries periodically to eliminate memory leaks
  const sweepIntervalMs = Math.min(60000, Math.max(10000, windowMs));
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, sweepIntervalMs);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGen(req);
    const now = Date.now();
    const clientIp = (req.ip || req.socket?.remoteAddress || 'unknown') as string;

    // Bounded capacity check: prevent memory exhaustion under high-burst / DoS attacks
    if (store.size >= maxEntries && !store.has(key)) {
      // Pass 1: Prune expired entries
      for (const [k, e] of store.entries()) {
        if (now > e.resetTime) {
          store.delete(k);
        }
      }
      // Pass 2: If still at capacity, evict oldest entries (FIFO / LRU head)
      while (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    }

    const entry = store.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count++;
    }

    store.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);

      if (options?.onLimitExceeded) {
        try {
          options.onLimitExceeded(req, {
            ip: clientIp,
            key,
            count: entry.count,
            max,
            windowMs,
            firstViolationInWindow: entry.count === max + 1
          });
        } catch {
          // Never fail rate-limit response if telemetry hook throws
        }
      }

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message
        }
      });
      return;
    }

    next();
  };
}

export const authRateLimiter = rateLimiter({
  windowMs: 60000,
  max: 15,
  message: 'Too many authentication attempts. Please try again after 1 minute.'
});
