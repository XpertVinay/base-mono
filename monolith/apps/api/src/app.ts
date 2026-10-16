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
        imgSrc: ["'self'", 'data:', 'blob:']
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

  // 404 Catch-All Route
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
  });

  // Centralized Safe Error Handling Middleware
  app.use(errorHandlerMiddleware);

  return app;
}
