import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export function rateLimiter(options?: { windowMs?: number; max?: number; message?: string }) {
  const windowMs = options?.windowMs || 60000;
  const max = options?.max || 120;
  const message = options?.message || 'Too many requests, please try again later.';
  const store = new Map<string, RateLimitStore>();

  // Prune expired entries periodically to eliminate memory leaks
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
    const key = (req.ip || req.socket.remoteAddress || 'anonymous') as string;
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
