import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { securityConfig } from './config/security.js';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { registerAllModules } from './bootstrap/register-modules.js';
import { registerRoutes } from './bootstrap/register-routes.js';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './infrastructure/docs/swagger-spec.js';
import { tokenService } from './shared/infrastructure/token.service.js';

export function createApp(): Express {
  const app = express();

  // Trust proxy for reverse proxies / load balancers
  app.set('trust proxy', 1);

  // OWASP Security Headers via Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://validator.swagger.io']
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS Policy
  app.use(cors(securityConfig.cors));

  // Response Compression
  app.use(compression());

  // Safe Request Body Parsing with strict limit to prevent DoS
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Correlation ID and Request Context
  app.use(correlationIdMiddleware);

  // Rate Limiting
  app.use(rateLimiter());

  // Bootstrap & Register Modules and Routes
  const registry = registerAllModules();
  registerRoutes(app, registry);

  // Standard OpenID Connect / RFC 7517 Discovery Endpoint (Root Level)
  app.get('/.well-known/jwks.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(tokenService.getJwks());
  });

  // Interactive Swagger UI & OpenAPI Specification
  app.get('/api-docs/swagger.json', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
  app.use(
    '/api-docs',
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Monolith API Documentation',
      customCss: '.swagger-ui .topbar { background-color: #0f172a; border-bottom: 2px solid #3b82f6; }'
    })
  );
  app.get('/docs', (_req: Request, res: Response) => res.redirect('/api-docs'));
  app.get('/swagger', (_req: Request, res: Response) => res.redirect('/api-docs'));

  // 404 Catch-All Route
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // Centralized Safe Error Handling Middleware
  app.use(errorHandlerMiddleware);

  return app;
}
