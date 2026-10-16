import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RequestContext {
  correlationId: string;
  userId?: string;
  userRole?: string;
  userEmail?: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.header('x-correlation-id') || req.header('x-request-id') || crypto.randomUUID()) as string;
  const userId = req.header('x-user-id') as string | undefined;
  const userRole = req.header('x-user-role') as string | undefined;
  const userEmail = req.header('x-user-email') as string | undefined;

  req.context = {
    correlationId,
    userId,
    userRole,
    userEmail
  };

  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', correlationId);
  next();
}
