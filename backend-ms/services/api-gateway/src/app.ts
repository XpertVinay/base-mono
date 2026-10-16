import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { logger } from './shared/infrastructure/logger.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:']
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(correlationIdMiddleware);
  app.use(rateLimiter({ windowMs: 60000, max: 300 }));

  // Gateway Liveness Check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      service: 'api-gateway',
      timestamp: new Date().toISOString()
    });
  });

  const serviceTargets: Record<string, string> = {
    iam: process.env.IAM_SERVICE_URL || 'http://localhost:4001',
    assets: process.env.ASSET_SERVICE_URL || 'http://localhost:4002',
    config: process.env.CONFIG_SERVICE_URL || 'http://localhost:4003',
    notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
    scheduler: process.env.SCHEDULER_SERVICE_URL || 'http://localhost:4005',
    orders: process.env.ORDER_SERVICE_URL || 'http://localhost:4006',
    transactions: process.env.TRANSACTION_SERVICE_URL || 'http://localhost:4007',
    search: process.env.SEARCH_SERVICE_URL || 'http://localhost:4008',
    inventory: process.env.INVENTORY_SERVICE_URL || 'http://localhost:4009',
    audit: process.env.AUDIT_SERVICE_URL || 'http://localhost:4011'
  };

  // Detailed Aggregated Health Check
  app.get('/health/detailed', async (_req: Request, res: Response) => {
    const checks: Record<string, { status: string; latencyMs: number; error?: string }> = {};
    let overallHealthy = true;

    await Promise.all(
      Object.entries(serviceTargets).map(async ([name, url]) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const response = await fetch(`${url}/health`, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response.ok) {
            checks[name] = { status: 'UP', latencyMs: Date.now() - start };
          } else {
            overallHealthy = false;
            checks[name] = { status: 'DEGRADED', latencyMs: Date.now() - start, error: `HTTP ${response.status}` };
          }
        } catch (err: any) {
          overallHealthy = false;
          checks[name] = { status: 'DOWN', latencyMs: Date.now() - start, error: err.message };
        }
      })
    );

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'UP' : 'DEGRADED',
      gateway: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: checks
    });
  });

  // Centralized JWT Auth & Identity Propagation Middleware
  const authPropagation = (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
      try {
        const decoded = jwt.verify(token, secret) as any;
        req.headers['x-user-id'] = decoded.sub || decoded.id;
        req.headers['x-user-email'] = decoded.email || '';
        req.headers['x-user-role'] = decoded.role || 'USER';
      } catch (err) {
        // Invalid token - downstream or auth middleware can reject
      }
    }
    next();
  };

  app.use(authPropagation);

  // Setup reverse proxies for all services
  const createServiceProxy = (targetUrl: string) => {
    return createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq: any, req: any) => {
          if (req.context?.correlationId) {
            proxyReq.setHeader('x-correlation-id', req.context.correlationId);
            proxyReq.setHeader('x-request-id', req.context.correlationId);
          }
          if (req.headers['x-user-id']) {
            proxyReq.setHeader('x-user-id', req.headers['x-user-id'] as string);
            proxyReq.setHeader('x-user-email', (req.headers['x-user-email'] || '') as string);
            proxyReq.setHeader('x-user-role', (req.headers['x-user-role'] || '') as string);
          }
        },
        error: (err: any, req: any, res: any) => {
          logger.error('Proxy routing error', err, { url: req.url });
          if (!res.headersSent) {
            res.status(502).json({
              success: false,
              error: {
                code: 'BAD_GATEWAY',
                message: 'Downstream microservice unavailable or unreachable'
              }
            });
          }
        }
      }
    });
  };

  app.use('/api/v1/iam', createServiceProxy(serviceTargets.iam));
  app.use('/api/iam', createServiceProxy(serviceTargets.iam));

  app.use('/api/v1/assets', createServiceProxy(serviceTargets.assets));
  app.use('/api/assets', createServiceProxy(serviceTargets.assets));

  app.use('/api/v1/config', createServiceProxy(serviceTargets.config));
  app.use('/api/config', createServiceProxy(serviceTargets.config));

  app.use('/api/v1/notifications', createServiceProxy(serviceTargets.notifications));
  app.use('/api/notifications', createServiceProxy(serviceTargets.notifications));

  app.use('/api/v1/scheduler', createServiceProxy(serviceTargets.scheduler));
  app.use('/api/scheduler', createServiceProxy(serviceTargets.scheduler));

  app.use('/api/v1/orders', createServiceProxy(serviceTargets.orders));
  app.use('/api/orders', createServiceProxy(serviceTargets.orders));

  app.use('/api/v1/transactions', createServiceProxy(serviceTargets.transactions));
  app.use('/api/transactions', createServiceProxy(serviceTargets.transactions));

  app.use('/api/v1/search', createServiceProxy(serviceTargets.search));
  app.use('/api/search', createServiceProxy(serviceTargets.search));

  app.use('/api/v1/inventory', createServiceProxy(serviceTargets.inventory));
  app.use('/api/inventory', createServiceProxy(serviceTargets.inventory));

  app.use('/api/v1/audit', createServiceProxy(serviceTargets.audit));
  app.use('/api/audit', createServiceProxy(serviceTargets.audit));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`API Route ${req.method} ${req.originalUrl}`));
  });

  app.use(errorHandlerMiddleware);

  return app;
}
