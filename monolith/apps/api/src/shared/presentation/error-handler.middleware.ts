import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../infrastructure/logger.js';
import { getCurrentRequestId } from './request-context.js';
import { env } from '../../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden: Insufficient privileges') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getCurrentRequestId();

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    logger.warn('Request validation failed', {
      requestId,
      path: req.path,
      method: req.method,
      issues: err.issues
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message
        }))
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle Operational App Errors
  if (err instanceof AppError) {
    logger.warn(`Operational error: ${err.message}`, {
      requestId,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Handle Unknown / Internal Errors (OWASP: Never leak stack trace or internal details)
  logger.error('Unhandled internal server error', err, {
    requestId,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred. Please contact support.' 
        : err.message
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString()
    }
  });
}
