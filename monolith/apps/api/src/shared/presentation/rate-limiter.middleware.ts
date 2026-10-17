import { Request, Response, NextFunction } from 'express';
import { securityConfig } from '../../config/security.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const stores = new Map<string, Map<string, RateLimitRecord>>();

// Periodic pruning every 60 seconds to prevent memory leaks from inactive IPs
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }
}, 60000);
cleanupTimer.unref();

export function rateLimiter(options?: { windowMs?: number; max?: number; prefix?: string; message?: string }) {
  const windowMs = options?.windowMs || securityConfig.rateLimit.windowMs;
  const max = options?.max || securityConfig.rateLimit.max;
  const prefix = options?.prefix || 'global';
  const customMessage = options?.message || 'Too many requests, please try again later.';

  if (!stores.has(prefix)) {
    stores.set(prefix, new Map<string, RateLimitRecord>());
  }
  const store = stores.get(prefix)!;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = store.get(ip);

    if (!record || now > record.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      return next();
    }

    record.count++;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: customMessage
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
  prefix: 'auth',
  message: 'Too many authentication attempts. Please try again after 1 minute.'
});
