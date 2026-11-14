import express, { Express, Request, Response, NextFunction } from 'express';
import * as grpc from '@grpc/grpc-js';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { getMultiTenancyConfig, tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import {
  rateLimiter,
  RateLimitViolationInfo
} from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { ApiResponse } from './shared/presentation/standard-response.js';
import { logger } from './shared/infrastructure/logger.js';
import { swaggerRestDoc } from './docs/swagger-rest.js';
import { swaggerGrpcDoc } from './docs/swagger-grpc.js';
import { swaggerCombinedDoc } from './docs/swagger-combined.js';
import {
  GRPC_SERVICE_DEFINITIONS,
  GrpcGatewayClientManager,
  GrpcHealthResult,
  ServiceKey
} from './grpc/grpc-gateway.client.js';

export interface ApiGatewayDependencies {
  grpcTargets?: Partial<Record<ServiceKey, string>>;
  grpcClientManager?: GrpcGatewayClientManager;
}

const SKIP_FORWARD_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'accept-encoding',
  'upgrade',
  'http2-settings'
]);

const SKIP_FORWARD_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'content-encoding',
  'upgrade'
]);

export function createApp(deps: ApiGatewayDependencies = {}): {
  app: Express;
  grpcManager: GrpcGatewayClientManager;
} {
  const app = express();
  const grpcManager = deps.grpcClientManager || new GrpcGatewayClientManager(deps.grpcTargets);

  app.set('trust proxy', 1);

  // Security: Strip untrusted client headers to prevent identity/tenant spoofing / privilege escalation
  app.use((req: Request, _res: Response, next: NextFunction) => {
    delete req.headers['x-user-id'];
    delete req.headers['x-user-email'];
    delete req.headers['x-user-role'];
    delete req.headers['x-internal-secret'];
    delete req.headers['x-gateway-signature'];
    delete req.headers['x-tenant-verified'];
    delete req.headers['x-auth-method'];
    delete req.headers['x-federated-provider'];
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

  const reportSecurityEventToAudit = (
    req: Request,
    event: {
      action: string;
      severity: 'WARN' | 'CRITICAL';
      resource: string;
      details: Record<string, unknown>;
    }
  ): void => {
    const correlationId = req.context?.correlationId || `sec-${Date.now()}`;
    const payload = JSON.stringify({
      actorEmail: 'gateway-security@system.internal',
      action: event.action,
      resource: event.resource,
      severity: event.severity,
      ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
      correlationId,
      details: {
        method: req.method,
        path: req.originalUrl || req.path,
        userAgent: req.header('user-agent') || 'unknown',
        ...event.details
      }
    });

    void grpcManager
      .dispatch(
        'audit',
        {
          method: 'POST',
          path: '/api/v1/audit/logs',
          headers: {
            'content-type': 'application/json',
            'x-correlation-id': correlationId
          },
          body: Buffer.from(payload, 'utf8'),
          clientIp: req.ip || '',
          correlationId
        },
        {
          'x-correlation-id': correlationId,
          'x-gateway-protocol': 'grpc'
        }
      )
      .catch((err) => {
        logger.warn('Unable to forward security event to audit-service', {
          action: event.action,
          error: err instanceof Error ? err.message : String(err)
        });
      });
  };

  const handleGatewayRateLimitViolation = (
    resource: string,
    action: string
  ) => (req: Request, info: RateLimitViolationInfo): void => {
    if (!info.firstViolationInWindow) return;
    logger.warn(`Gateway rate-limit breach: ${action}`, {
      ip: info.ip,
      path: req.originalUrl,
      count: info.count,
      max: info.max
    });
    reportSecurityEventToAudit(req, {
      action,
      severity: 'CRITICAL',
      resource,
      details: {
        requestCount: info.count,
        limit: info.max,
        windowMs: info.windowMs
      }
    });
  };

  const gatewayRateLimiter = rateLimiter({
    windowMs: 60000,
    max: 300,
    onLimitExceeded: handleGatewayRateLimitViolation('ApiGateway', 'DDOS_RATE_LIMIT_BREACH')
  });

  const strictAuthRateLimiter = rateLimiter({
    windowMs: 60000,
    max: 15,
    message: 'Too many authentication attempts. Please try again after 1 minute.',
    onLimitExceeded: handleGatewayRateLimitViolation('IamAuthGateway', 'AUTH_BRUTE_FORCE_DETECTED')
  });

  const auditRateLimiter = rateLimiter({
    windowMs: 60000,
    max: parseInt(process.env.AUDIT_GATEWAY_RATE_LIMIT_MAX || '90', 10),
    message: 'Too many audit telemetry requests. Incident reported to security monitor.',
    onLimitExceeded: handleGatewayRateLimitViolation('AuditGateway', 'DDOS_RATE_LIMIT_BREACH')
  });

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(gatewayRateLimiter);

  // Gateway Liveness Check Handler
  const handleHealth = (req: Request, res: Response) => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'API Gateway is healthy and operational',
      data: {
        gateway: 'api-gateway',
        version: 'v1',
        transport: 'grpc+http2',
        status: 'UP',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        mappedServices: Object.keys(GRPC_SERVICE_DEFINITIONS).length
      },
      meta: {
        further_steps: [
          'Detailed downstream gRPC health available at /api/v1/health/detailed',
          'Explore interactive documentation at /api-docs'
        ]
      }
    });
  };

  // Detailed Aggregated Downstream gRPC Health Check Handler
  const handleDetailedHealth = async (req: Request, res: Response) => {
    const checks: Record<string, GrpcHealthResult> = {};
    let overallHealthy = true;

    const keys = Object.keys(GRPC_SERVICE_DEFINITIONS) as ServiceKey[];
    await Promise.all(
      keys.map(async (key) => {
        const result = await grpcManager.healthCheck(key, 2000);
        checks[key] = result;
        if (result.status !== 'UP') {
          overallHealthy = false;
        }
      })
    );

    if (overallHealthy) {
      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'All microservices downstream are operational via gRPC',
        data: {
          gateway: 'api-gateway',
          version: 'v1',
          transport: 'grpc+http2',
          services: checks,
          circuitBreakers: Object.fromEntries(
            keys.map((k) => [k, grpcManager.getCircuitBreakerStatus(k)?.status || 'CLOSED'])
          )
        }
      });
    } else {
      ApiResponse.error(res, {
        req,
        statusCode: 503,
        message: 'One or more downstream gRPC services are degraded or unavailable',
        errors: Object.entries(checks)
          .filter(([_, v]) => v.status !== 'UP')
          .map(([k, v]) => ({ service: k, status: v.status, target: v.target, error: v.error })),
        meta: {
          debug: { checks },
          circuitBreakers: Object.fromEntries(
            keys.map((k) => [k, grpcManager.getCircuitBreakerStatus(k)?.status || 'CLOSED'])
          ),
          further_steps: [
            'Check individual service gRPC servers and container liveness',
            'Verify system health at /api/v1/health/detailed'
          ]
        }
      });
    }
  };

  // Priority Health Endpoints (Version-Controlled + Aliases)
  app.get('/api/v1/health', handleHealth);
  app.get('/api/v1/health/detailed', handleDetailedHealth);
  app.get('/api/health', handleHealth);
  app.get('/api/health/detailed', handleDetailedHealth);
  app.get('/health', handleHealth);
  app.get('/health/detailed', handleDetailedHealth);

  // API Discovery & Metadata Directory Endpoints
  app.get('/api', (req: Request, res: Response) => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Enterprise Microservices Platform API Gateway (gRPC Upstream)',
      data: {
        currentVersion: 'v1',
        supportedVersions: ['v1'],
        upstreamProtocol: 'grpc+http2',
        endpoints: {
          v1: '/api/v1',
          health: '/api/v1/health',
          detailedHealth: '/api/v1/health/detailed',
          docs: '/api-docs'
        }
      }
    });
  });

  app.get('/api/v1', (req: Request, res: Response) => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Enterprise Microservices Platform API v1 Directory',
      data: {
        version: 'v1',
        upstreamProtocol: 'grpc+http2',
        health: '/api/v1/health',
        detailedHealth: '/api/v1/health/detailed',
        docs: '/api-docs',
        services: {
          iam: '/api/v1/iam',
          assets: '/api/v1/assets',
          config: '/api/v1/config',
          notifications: '/api/v1/notifications',
          scheduler: '/api/v1/scheduler',
          orders: '/api/v1/orders',
          transactions: '/api/v1/transactions',
          search: '/api/v1/search',
          inventory: '/api/v1/inventory',
          ai: '/api/v1/ai',
          audit: '/api/v1/audit',
          organizations: '/api/v1/organizations',
          rbac: '/api/v1/rbac'
        },
        grpcMapping: grpcManager.getServiceMap()
      }
    });
  });

  // Strict rate limiting on authentication routes to mitigate brute force & credential stuffing
  app.use('/api/v1/iam/login', strictAuthRateLimiter);
  app.use('/api/iam/login', strictAuthRateLimiter);
  app.use('/api/v1/iam/register', strictAuthRateLimiter);
  app.use('/api/iam/register', strictAuthRateLimiter);
  app.use('/api/v1/iam/refresh', strictAuthRateLimiter);
  app.use('/api/iam/refresh', strictAuthRateLimiter);
  app.use('/api/v1/iam/oidc/token-exchange', strictAuthRateLimiter);
  app.use('/api/iam/oidc/token-exchange', strictAuthRateLimiter);
  app.use('/api/v1/audit', auditRateLimiter);
  app.use('/api/audit', auditRateLimiter);

  // Swagger OpenAPI Documentation JSON Endpoints
  const serveOpenApiJson = (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerCombinedDoc);
  };

  const serveRestJson = (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerRestDoc);
  };

  const serveGrpcJson = (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerGrpcDoc);
  };

  app.get('/api-docs/openapi.json', serveOpenApiJson);
  app.get('/api-docs/rest.json', serveRestJson);
  app.get('/api-docs/grpc.json', serveGrpcJson);

  // Versioned doc JSON endpoints
  app.get('/api/v1/openapi.json', serveOpenApiJson);
  app.get('/api/v1/rest.json', serveRestJson);
  app.get('/api/v1/grpc.json', serveGrpcJson);

  // Unversioned API doc JSON endpoints
  app.get('/api/openapi.json', serveOpenApiJson);
  app.get('/api/rest.json', serveRestJson);
  app.get('/api/grpc.json', serveGrpcJson);

  // Swagger UI with Multi-Spec Selection (REST + gRPC + Combined)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(
      swaggerCombinedDoc as swaggerUi.JsonObject,
      {
        explorer: true,
        swaggerUrls: [
          { url: '/api-docs/openapi.json', name: 'Unified Platform (REST & gRPC)' },
          { url: '/api-docs/rest.json', name: 'HTTP REST APIs (All Microservices)' },
          { url: '/api-docs/grpc.json', name: 'gRPC Services Contract (All Microservices :50051–:50063)' }
        ] as any,
        swaggerOptions: {
          filter: true,
          docExpansion: 'list'
        },
        customSiteTitle: 'Enterprise Microservices API & gRPC Documentation',
        customCss: `
          .swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #3b82f6; }
          .swagger-ui .topbar-wrapper img { content: url('https://raw.githubusercontent.com/swagger-api/swagger-ui/master/dist/favicon-32x32.png'); }
          .swagger-ui .info { margin: 25px 0; }
          .swagger-ui .info .title { color: #1e293b; font-weight: 700; }
        `
      } as swaggerUi.SwaggerUiOptions
    )
  );

  // Convenient doc redirects
  app.get('/docs', (_req: Request, res: Response) => res.redirect('/api-docs/'));
  app.get('/swagger', (_req: Request, res: Response) => res.redirect('/api-docs/'));
  app.get('/api/docs', (_req: Request, res: Response) => res.redirect('/api-docs/'));
  app.get('/api/v1/docs', (_req: Request, res: Response) => res.redirect('/api-docs/'));

  // Centralized JWT Auth, Multi-Tenant & Identity Propagation Middleware
  const authPropagation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const mtConfig = getMultiTenancyConfig();
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const requestedTenantId = req.header(mtConfig.tenantHeader)?.trim();

      const applyIdentity = (claims: {
        userId: string;
        email?: string;
        role?: string;
        tenantId?: string;
        tenantSlug?: string;
        authMethod?: string;
        provider?: string;
      }): boolean => {
        const tokenTenantId = mtConfig.enabled
          ? (claims.tenantId || mtConfig.defaultTenantId)
          : mtConfig.defaultTenantId;

        if (mtConfig.enabled && requestedTenantId && requestedTenantId !== tokenTenantId) {
          res.status(403).json({
            success: false,
            error: {
              code: 'TENANT_MISMATCH',
              message: 'Requested tenant header does not match authenticated JWT tenant'
            }
          });
          return false;
        }

        req.headers['x-user-id'] = claims.userId;
        req.headers['x-user-email'] = claims.email || '';
        req.headers['x-user-role'] = claims.role || 'USER';
        req.headers[mtConfig.tenantHeader] = tokenTenantId;
        if (claims.tenantSlug) {
          req.headers[mtConfig.tenantSlugHeader] = claims.tenantSlug;
        }
        req.headers['x-tenant-verified'] = 'true';
        req.headers['x-auth-method'] = claims.authMethod || 'LOCAL';
        if (claims.provider) {
          req.headers['x-federated-provider'] = claims.provider;
        }
        return true;
      };

      if (process.env.VERIFY_TOKEN_VIA_GRPC === 'true') {
        try {
          const grpcResult = await grpcManager.verifyToken(token, mtConfig.enabled ? requestedTenantId : undefined);
          if (grpcResult?.valid) {
            const ok = applyIdentity({
              userId: grpcResult.data?.userId || grpcResult.userId,
              email: grpcResult.data?.email || grpcResult.email,
              role: grpcResult.data?.role || grpcResult.role,
              tenantId: grpcResult.data?.tenantId || grpcResult.tenantId,
              tenantSlug: grpcResult.data?.tenantSlug || grpcResult.tenantSlug,
              authMethod: grpcResult.data?.authMethod || grpcResult.authMethod,
              provider: grpcResult.data?.provider
            });
            if (!ok) return;
            next();
            return;
          }
          if (grpcResult?.errors?.some((e: any) => e.code === 'TENANT_MISMATCH')) {
            res.status(403).json({
              success: false,
              error: {
                code: 'TENANT_MISMATCH',
                message: 'Requested tenant header does not match authenticated JWT tenant'
              }
            });
            return;
          }
        } catch {
          // Fall through to local JWT verification if IAM gRPC is temporarily unreachable
        }
      }

      const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
      try {
        const decoded = jwt.verify(token, secret) as any;
        const ok = applyIdentity({
          userId: decoded.sub || decoded.id,
          email: decoded.email,
          role: decoded.role,
          tenantId: decoded.tenantId || decoded.tid,
          tenantSlug: decoded.tenantSlug,
          authMethod: decoded.authMethod,
          provider: decoded.provider
        });
        if (!ok) return;
      } catch {
        // Invalid token - report anomaly to audit monitor and let downstream auth handle
        reportSecurityEventToAudit(req, {
          action: 'INVALID_JWT_TOKEN_DETECTED',
          severity: 'WARN',
          resource: 'ApiGatewayAuth',
          details: { reason: 'JWT verification failed' }
        });
      }
    }
    next();
  };

  app.use(authPropagation);

  // Raw body parser for transparent byte-for-byte gRPC upstream dispatch
  const rawBodyParser = express.raw({ type: '*/*', limit: '10mb' });

  // Unified gRPC Upstream Dispatcher for all microservices
  const createGrpcServiceDispatcher = (serviceKey: ServiceKey, serviceName: string) => {
    const target = grpcManager.getTarget(serviceKey);

    return async (req: Request, res: Response): Promise<void> => {
      const mtConfig = getMultiTenancyConfig();
      const correlationId = req.context?.correlationId || `req-${Date.now()}`;
      const forwardedHeaders: Record<string, string> = {};

      for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase();
        if (SKIP_FORWARD_REQUEST_HEADERS.has(lower) || value === undefined) continue;
        forwardedHeaders[lower] = Array.isArray(value) ? value.map(String).join(', ') : String(value);
      }

      forwardedHeaders['x-correlation-id'] = correlationId;
      forwardedHeaders['x-request-id'] = correlationId;
      forwardedHeaders['x-gateway-protocol'] = 'grpc';
      if (req.ip) {
        const existingFwd = forwardedHeaders['x-forwarded-for'];
        forwardedHeaders['x-forwarded-for'] = existingFwd ? `${existingFwd}, ${req.ip}` : req.ip;
      }

      const resolvedTenantId = (req.headers[mtConfig.tenantHeader] || req.tenant?.tenantId) as string | undefined;
      if (resolvedTenantId) {
        forwardedHeaders[mtConfig.tenantHeader] = resolvedTenantId;
      }
      const resolvedTenantSlug = (req.headers[mtConfig.tenantSlugHeader] || req.tenant?.tenantSlug) as string | undefined;
      if (resolvedTenantSlug) {
        forwardedHeaders[mtConfig.tenantSlugHeader] = resolvedTenantSlug;
      }

      const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-service-secret-token-32-chars';
      if (req.headers['x-user-id']) {
        forwardedHeaders['x-user-id'] = req.headers['x-user-id'] as string;
        forwardedHeaders['x-user-email'] = (req.headers['x-user-email'] || '') as string;
        forwardedHeaders['x-user-role'] = (req.headers['x-user-role'] || '') as string;
        forwardedHeaders['x-tenant-verified'] = (req.headers['x-tenant-verified'] || 'true') as string;
        if (req.headers['x-auth-method']) {
          forwardedHeaders['x-auth-method'] = req.headers['x-auth-method'] as string;
        }
        if (req.headers['x-federated-provider']) {
          forwardedHeaders['x-federated-provider'] = req.headers['x-federated-provider'] as string;
        }
        forwardedHeaders['x-internal-secret'] = internalSecret;
      }

      const bodyBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
          ? Buffer.from(JSON.stringify(req.body), 'utf8')
          : Buffer.alloc(0);

      const grpcMetadata: Record<string, string> = {
        'x-correlation-id': correlationId,
        'x-request-id': correlationId,
        'x-gateway-protocol': 'grpc'
      };
      if (resolvedTenantId) grpcMetadata[mtConfig.tenantHeader] = resolvedTenantId;
      if (resolvedTenantSlug) grpcMetadata[mtConfig.tenantSlugHeader] = resolvedTenantSlug;
      if (req.headers['x-user-id']) {
        grpcMetadata['x-user-id'] = req.headers['x-user-id'] as string;
        grpcMetadata['x-user-role'] = (req.headers['x-user-role'] || '') as string;
        grpcMetadata['x-internal-secret'] = internalSecret;
      }

      try {
        const upstream = await grpcManager.dispatch(
          serviceKey,
          {
            method: req.method,
            path: req.originalUrl,
            headers: forwardedHeaders,
            body: bodyBuffer,
            clientIp: req.ip || '',
            correlationId
          },
          grpcMetadata
        );

        for (const [hdrKey, hdrVal] of Object.entries(upstream.headers)) {
          const lower = hdrKey.toLowerCase();
          if (SKIP_FORWARD_RESPONSE_HEADERS.has(lower)) continue;
          res.setHeader(hdrKey, hdrVal);
        }

        res.setHeader('x-gateway-upstream', `${serviceName}:grpc`);
        res.status(upstream.statusCode || 200).send(upstream.body);
      } catch (err: any) {
        const isCircuitBreaker = err?.isCircuitBreakerOpen === true;
        const isTimeout = err?.code === grpc.status.DEADLINE_EXCEEDED;
        const statusCode = isCircuitBreaker ? 503 : isTimeout ? 504 : 502;
        const errorCode = isCircuitBreaker ? 'CIRCUIT_BREAKER_OPEN' : isTimeout ? 'GATEWAY_TIMEOUT' : 'BAD_GATEWAY';
        const message = isCircuitBreaker
          ? `Downstream gRPC service '${serviceName}' circuit breaker is OPEN due to repeated failures`
          : `Downstream gRPC microservice '${serviceName}' is unavailable or timed out`;

        if (isCircuitBreaker && err.retryAfterSeconds) {
          res.setHeader('Retry-After', String(err.retryAfterSeconds));
        }

        logger.error(`gRPC dispatch error for ${serviceName}`, err, {
          url: req.originalUrl,
          target,
          grpcCode: err?.code,
          isCircuitBreaker
        });

        if (!res.headersSent) {
          ApiResponse.error(res, {
            req,
            statusCode,
            message,
            errors: [
              {
                code: errorCode,
                service: serviceName,
                target,
                message: err?.details || err?.message || 'gRPC connection refused or timed out'
              }
            ],
            meta: {
              debug: { target, serviceName, transport: 'grpc' },
              further_steps: [
                `Ensure ${serviceName} gRPC server is running and reachable at ${target}`,
                'Verify system health at /api/v1/health/detailed'
              ]
            }
          });
        }
      }
    };
  };

  // Mount all 11 microservices via gRPC upstream dispatch
  const serviceRouteMappings: Array<{ key: ServiceKey; paths: string[] }> = [
    { key: 'iam', paths: ['/api/v1/iam', '/api/iam'] },
    { key: 'assets', paths: ['/api/v1/assets', '/api/assets'] },
    { key: 'config', paths: ['/api/v1/config', '/api/config'] },
    { key: 'notifications', paths: ['/api/v1/notifications', '/api/notifications'] },
    { key: 'scheduler', paths: ['/api/v1/scheduler', '/api/scheduler'] },
    { key: 'orders', paths: ['/api/v1/orders', '/api/orders'] },
    { key: 'transactions', paths: ['/api/v1/transactions', '/api/transactions'] },
    { key: 'search', paths: ['/api/v1/search', '/api/search'] },
    { key: 'inventory', paths: ['/api/v1/inventory', '/api/inventory'] },
    { key: 'ai', paths: ['/api/v1/ai', '/api/ai'] },
    { key: 'audit', paths: ['/api/v1/audit', '/api/audit'] },
    { key: 'organizations', paths: ['/api/v1/organizations', '/api/organizations'] },
    { key: 'rbac', paths: ['/api/v1/rbac', '/api/rbac'] }
  ];

  for (const mapping of serviceRouteMappings) {
    const def = GRPC_SERVICE_DEFINITIONS[mapping.key];
    const dispatcher = createGrpcServiceDispatcher(mapping.key, def.serviceName);
    for (const routePath of mapping.paths) {
      app.use(routePath, rawBodyParser, dispatcher);
    }
  }

  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`API Route ${req.method} ${req.originalUrl}`));
  });

  app.use(errorHandlerMiddleware);

  return { app, grpcManager };
}
