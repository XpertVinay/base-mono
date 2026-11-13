import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export interface RateLimitViolationInfo {
  ip: string;
  count: number;
  max: number;
  windowMs: number;
  firstViolationInWindow: boolean;
}

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  onLimitExceeded?: (req: Request, info: RateLimitViolationInfo) => void;
}

export function rateLimiter(options: RateLimiterOptions = { windowMs: 60000, max: 120 }) {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 120;
  const message = options.message || 'Too many requests, please try again later.';
  const store = new Map<string, RateLimitStore>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, Math.max(10000, windowMs));
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.ip || req.socket?.remoteAddress || 'anonymous') as string;
    const now = Date.now();
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

      if (options.onLimitExceeded) {
        try {
          options.onLimitExceeded(req, {
            ip: key,
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
