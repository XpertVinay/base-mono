import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresConfigRepository } from './infrastructure/persistence/postgres-config.repository.js';
import { CachedConfigRepository } from './infrastructure/persistence/cached-config.repository.js';
import { IConfigRepository } from './domain/repositories/config-repository.interface.js';
import {
  GetConfigQuery,
  SetConfigUseCase,
  ListConfigsQuery,
  DeleteConfigUseCase
} from './application/use-cases/config.use-cases.js';
import { ConfigController } from './presentation/http/config.controller.js';
import { createConfigRouter } from './presentation/http/config.routes.js';

export function createApp(customRepo?: IConfigRepository): { app: Express; repo: IConfigRepository } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const baseRepo = customRepo || new PostgresConfigRepository();
  const repo = baseRepo instanceof CachedConfigRepository ? baseRepo : new CachedConfigRepository(baseRepo);
  const getQuery = new GetConfigQuery(repo);
  const setUseCase = new SetConfigUseCase(repo);
  const listQuery = new ListConfigsQuery(repo);
  const deleteUseCase = new DeleteConfigUseCase(repo);

  const controller = new ConfigController(getQuery, setUseCase, listQuery, deleteUseCase);
  const router = createConfigRouter(controller);

  // Health probes (versioned + unversioned + container probe)
  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({ status: 'ok', service: 'config-service', version: 'v1', timestamp: new Date().toISOString() });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/config/health',
      '/api/config/health',
      '/api/v1/health',
      '/api/health'
    ],
    healthHandler
  );

  // Canonical Back-Office Routes (Feature F12)
  app.use('/api/v1/backoffice/config', router);
  app.use('/api/backoffice/config', router);

  app.use('/api/v1/config', router);
  app.use('/api/config', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, repo };
}
