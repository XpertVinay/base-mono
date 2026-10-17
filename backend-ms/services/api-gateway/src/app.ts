import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import https from 'https';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter, authRateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { ApiResponse } from './shared/presentation/standard-response.js';
import { logger } from './shared/infrastructure/logger.js';
import { swaggerRestDoc } from './docs/swagger-rest.js';
import { swaggerGrpcDoc } from './docs/swagger-grpc.js';
import { swaggerCombinedDoc } from './docs/swagger-combined.js';

// High-performance HTTP Keep-Alive Agents for persistent upstream connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 60000
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 60000
});

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  // Security: Strip untrusted client headers to prevent identity spoofing / privilege escalation
  app.use((req: Request, _res: Response, next: NextFunction) => {
    delete req.headers['x-user-id'];
    delete req.headers['x-user-email'];
    delete req.headers['x-user-role'];
    delete req.headers['x-internal-secret'];
    delete req.headers['x-gateway-signature'];
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://validator.swagger.io']
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(correlationIdMiddleware);
  app.use(rateLimiter({ windowMs: 60000, max: 300 }));

  // Strict rate limiting on authentication routes to mitigate brute force & credential stuffing
  app.use('/api/v1/iam/login', authRateLimiter);
  app.use('/api/iam/login', authRateLimiter);
  app.use('/api/v1/iam/register', authRateLimiter);
  app.use('/api/iam/register', authRateLimiter);

  // Swagger OpenAPI Documentation JSON Endpoints
  app.get('/api-docs/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerCombinedDoc);
  });

  app.get('/api-docs/rest.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerRestDoc);
  });

  app.get('/api-docs/grpc.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerGrpcDoc);
  });

  // Swagger UI with Multi-Spec Selection (REST + gRPC + Combined)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      explorer: true,
      swaggerOptions: {
        urls: [
          { url: '/api-docs/openapi.json', name: 'Unified Platform (REST & gRPC)' },
          { url: '/api-docs/rest.json', name: 'HTTP REST APIs (All Microservices)' },
          { url: '/api-docs/grpc.json', name: 'gRPC Services Contract (:50051, :50053, :50059, :50061)' }
        ]
      },
      customSiteTitle: 'Enterprise Microservices API & gRPC Documentation',
      customCss: `
        .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #3b82f6; }
        .swagger-ui .topbar-wrapper img { content: url('https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist/favicon-32x32.png'); }
        .swagger-ui .info { margin: 25px 0; }
        .swagger-ui .info .title { color: #1e293b; font-weight: 700; }
      `
    })
  );

  // Convenient doc redirects
  app.get('/docs', (_req: Request, res: Response) => res.redirect('/api-docs/'));
  app.get('/swagger', (_req: Request, res: Response) => res.redirect('/api-docs/'));

  // Gateway Liveness Check with Standard Response
  app.get('/health', (req: Request, res: Response) => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'API Gateway is healthy and operational',
      data: {
        gateway: 'api-gateway',
        status: 'UP',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      },
      meta: {
        further_steps: [
          'Detailed downstream health available at /health/detailed',
          'Explore interactive documentation at /api-docs'
        ]
      }
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

  // Detailed Aggregated Health Check with Standard Response
  app.get('/health/detailed', async (req: Request, res: Response) => {
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

    if (overallHealthy) {
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'All microservices downstream are operational',
        data: {
          gateway: 'api-gateway',
          services: checks
        }
      });
    } else {
      ApiResponse.error(res, {
        req,
        statusCode: 503,
        message: 'One or more downstream services are degraded or unavailable',
        errors: Object.entries(checks)
          .filter(([_, v]) => v.status !== 'UP')
          .map(([k, v]) => ({ service: k, status: v.status, error: v.error })),
        meta: {
          debug: { checks },
          further_steps: ['Check individual service logs or container liveness']
        }
      });
    }
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
        // Invalid token - downstream or auth middleware will handle
      }
    }
    next();
  };

  app.use(authPropagation);

  // Setup reverse proxies for all services
  const createServiceProxy = (targetUrl: string, serviceName: string) => {
    return createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      agent: targetUrl.startsWith('https') ? httpsAgent : httpAgent,
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
            proxyReq.setHeader(
              'x-internal-secret',
              process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars'
            );
          }
        },
        error: (err: any, req: any, res: any) => {
          logger.error(`Proxy routing error for ${serviceName}`, err, { url: req.url });
          if (!res.headersSent) {
            ApiResponse.error(res, {
              req,
              statusCode: 502,
              message: `Downstream microservice '${serviceName}' is unavailable or unreachable`,
              errors: [
                {
                  code: 'BAD_GATEWAY',
                  service: serviceName,
                  message: err.message || 'Connection refused or timed out'
                }
              ],
              meta: {
                debug: { targetUrl, serviceName },
                further_steps: [
                  `Ensure ${serviceName} is running and reachable at ${targetUrl}`,
                  'Verify system health at /health/detailed'
                ]
              }
            });
          }
        }
      }
    });
  };

  app.use('/api/v1/iam', createServiceProxy(serviceTargets.iam, 'iam-service'));
  app.use('/api/iam', createServiceProxy(serviceTargets.iam, 'iam-service'));

  app.use('/api/v1/assets', createServiceProxy(serviceTargets.assets, 'asset-service'));
  app.use('/api/assets', createServiceProxy(serviceTargets.assets, 'asset-service'));

  app.use('/api/v1/config', createServiceProxy(serviceTargets.config, 'config-service'));
  app.use('/api/config', createServiceProxy(serviceTargets.config, 'config-service'));

  app.use('/api/v1/notifications', createServiceProxy(serviceTargets.notifications, 'notification-service'));
  app.use('/api/notifications', createServiceProxy(serviceTargets.notifications, 'notification-service'));

  app.use('/api/v1/scheduler', createServiceProxy(serviceTargets.scheduler, 'scheduler-service'));
  app.use('/api/scheduler', createServiceProxy(serviceTargets.scheduler, 'scheduler-service'));

  app.use('/api/v1/orders', createServiceProxy(serviceTargets.orders, 'order-service'));
  app.use('/api/orders', createServiceProxy(serviceTargets.orders, 'order-service'));

  app.use('/api/v1/transactions', createServiceProxy(serviceTargets.transactions, 'transaction-service'));
  app.use('/api/transactions', createServiceProxy(serviceTargets.transactions, 'transaction-service'));

  app.use('/api/v1/search', createServiceProxy(serviceTargets.search, 'search-service'));
  app.use('/api/search', createServiceProxy(serviceTargets.search, 'search-service'));

  app.use('/api/v1/inventory', createServiceProxy(serviceTargets.inventory, 'inventory-service'));
  app.use('/api/inventory', createServiceProxy(serviceTargets.inventory, 'inventory-service'));

  app.use('/api/v1/audit', createServiceProxy(serviceTargets.audit, 'audit-service'));
  app.use('/api/audit', createServiceProxy(serviceTargets.audit, 'audit-service'));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`API Route ${req.method} ${req.originalUrl}`));
  });

  app.use(errorHandlerMiddleware);

  return app;
}
