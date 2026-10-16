import { AsyncLocalStorage } from 'async_hooks';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestStore {
  requestId: string;
  correlationId: string;
  userId?: string;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const correlationId = (req.headers['x-correlation-id'] as string) || requestId;
  const startTime = Date.now();

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  requestContext.run({ requestId, correlationId, startTime }, () => {
    next();
  });
}

export function getCurrentRequestId(): string {
  return requestContext.getStore()?.requestId || 'system';
}
