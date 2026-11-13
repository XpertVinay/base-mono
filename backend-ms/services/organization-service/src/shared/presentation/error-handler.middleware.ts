import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger.js';

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST',
    public readonly details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.context?.correlationId || (req.header('x-request-id') as string) || (req.header('x-correlation-id') as string) || `req-${Date.now()}`;
  const isDev = process.env.NODE_ENV !== 'production';

  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      correlationId
    });

    res.status(err.statusCode).json({
      status: false,
      message: err.message,
      data: null,
      errors: [
        {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {})
        }
      ],
      meta_data: {
        requestId: correlationId,
        timestamp: new Date().toISOString(),
        pagination: null,
        further_steps: ['Verify configuration key or permissions in /api-docs'],
        ...(isDev ? {
          debug: {
            service: 'organization-service',
            env: process.env.NODE_ENV || 'development',
            code: err.code
          }
        } : {})
      }
    });
    return;
  }

  if (err.name === 'ZodError') {
    const errorList = (err.errors || []).map((e: any) => ({
      code: 'VALIDATION_ERROR',
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path),
      message: e.message
    }));

    res.status(400).json({
      status: false,
      message: 'Validation error: invalid request input',
      data: null,
      errors: errorList,
      meta_data: {
        requestId: correlationId,
        timestamp: new Date().toISOString(),
        pagination: null,
        further_steps: ['Check request payload schema in /api-docs'],
        ...(isDev ? {
          debug: {
            service: 'organization-service',
            env: process.env.NODE_ENV || 'development'
          }
        } : {})
      }
    });
    return;
  }

  logger.error('Unhandled internal server error', err, { correlationId });

  res.status(500).json({
    status: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected internal error occurred' 
      : err.message || 'Internal Server Error',
    data: null,
    errors: [
      {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Internal Server Error'
      }
    ],
    meta_data: {
      requestId: correlationId,
      timestamp: new Date().toISOString(),
      pagination: null,
      further_steps: ['Retry operation or inspect organization-service logs'],
      ...(isDev ? {
        debug: {
          service: 'organization-service',
          env: process.env.NODE_ENV || 'development',
          stack: err.stack
        }
      } : {})
    }
  });
}
