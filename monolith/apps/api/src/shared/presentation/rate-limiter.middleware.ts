import { Request, Response, NextFunction } from 'express';
import { securityConfig } from '../../config/security.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipHits = new Map<string, RateLimitRecord>();

export function rateLimiter(options?: { windowMs?: number; max?: number }) {
  const windowMs = options?.windowMs || securityConfig.rateLimit.windowMs;
  const max = options?.max || securityConfig.rateLimit.max;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = ipHits.get(ip);

    if (!record || now > record.resetTime) {
      ipHits.set(ip, { count: 1, resetTime: now + windowMs });
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
