import { Response, Request } from 'express';

export interface MetaDataOptions {
  requestId?: string;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  } | null;
  further_steps?: string[] | null;
  debug?: Record<string, any>;
  [key: string]: any;
}

export interface StandardResponsePayload<T = any> {
  status: boolean;
  message: string;
  data?: T;
  errors: any[];
  meta_data: {
    requestId: string;
    timestamp: string;
    debug?: Record<string, any>;
    pagination?: Record<string, any> | null;
    further_steps?: string[] | null;
    [key: string]: any;
  };
}

export class ApiResponse {
  static success<T>(
    res: Response,
    options: {
      data?: T;
      message?: string;
      statusCode?: number;
      meta?: MetaDataOptions;
      req?: Request;
    }
  ): void {
    const statusCode = options.statusCode || 200;
    const req = options.req;
    const requestId = options.meta?.requestId 
      || (req as any)?.context?.correlationId 
      || (req as any)?.headers?.['x-request-id']
      || (req as any)?.headers?.['x-correlation-id']
      || `req-${Date.now()}`;

    const isDev = process.env.NODE_ENV !== 'production';

    const payload: StandardResponsePayload<T> = {
      status: true,
      message: options.message || 'Operation completed successfully',
      data: options.data,
      errors: [],
      meta_data: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: options.meta?.pagination ?? null,
        further_steps: options.meta?.further_steps ?? null,
        ...(isDev ? {
          debug: {
            service: process.env.SERVICE_NAME || 'inventory-service',
            env: process.env.NODE_ENV || 'development',
            ...(options.meta?.debug || {})
          }
        } : {})
      }
    };

    res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    options: {
      message: string;
      statusCode?: number;
      errors?: any[];
      meta?: MetaDataOptions;
      req?: Request;
    }
  ): void {
    const statusCode = options.statusCode || 400;
    const req = options.req;
    const requestId = options.meta?.requestId 
      || (req as any)?.context?.correlationId 
      || (req as any)?.headers?.['x-request-id']
      || (req as any)?.headers?.['x-correlation-id']
      || `req-${Date.now()}`;

    const isDev = process.env.NODE_ENV !== 'production';

    const payload: StandardResponsePayload<null> = {
      status: false,
      message: options.message,
      data: null,
      errors: options.errors || [options.message],
      meta_data: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination: options.meta?.pagination ?? null,
        further_steps: options.meta?.further_steps ?? null,
        ...(isDev ? {
          debug: {
            service: process.env.SERVICE_NAME || 'inventory-service',
            env: process.env.NODE_ENV || 'development',
            ...(options.meta?.debug || {})
          }
        } : {})
      }
    };

    res.status(statusCode).json(payload);
  }
}
