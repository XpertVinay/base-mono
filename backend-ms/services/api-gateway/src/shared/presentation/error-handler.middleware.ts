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
  const correlationId = req.context?.correlationId || req.header('x-request-id') || 'unknown';

  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      correlationId
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      meta: {
        requestId: correlationId,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: err.errors
      },
      meta: {
        requestId: correlationId,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  logger.error('Unhandled internal server error', err, { correlationId });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected internal error occurred' 
        : err.message || 'Internal Server Error'
    },
    meta: {
      requestId: correlationId,
      timestamp: new Date().toISOString()
    }
  });
}
