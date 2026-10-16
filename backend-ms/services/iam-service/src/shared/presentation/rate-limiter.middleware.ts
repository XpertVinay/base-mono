import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

export function rateLimiter(options = { windowMs: 60000, max: 120 }) {
  const store = new Map<string, RateLimitStore>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.ip || 'anonymous') as string;
    const now = Date.now();
    const entry = store.get(key) || { count: 0, resetTime: now + options.windowMs };

    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + options.windowMs;
    } else {
      entry.count++;
    }

    store.set(key, entry);

    if (entry.count > options.max) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.'
        }
      });
      return;
    }

    next();
  };
}
