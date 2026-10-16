import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresConfigRepository } from './infrastructure/persistence/postgres-config.repository.js';
import {
  GetConfigQuery,
  SetConfigUseCase,
  ListConfigsQuery,
  DeleteConfigUseCase
} from './application/use-cases/config.use-cases.js';
import { ConfigController } from './presentation/http/config.controller.js';
import { createConfigRouter } from './presentation/http/config.routes.js';

export function createApp(): { app: Express; repo: PostgresConfigRepository } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const repo = new PostgresConfigRepository();
  const getQuery = new GetConfigQuery(repo);
  const setUseCase = new SetConfigUseCase(repo);
  const listQuery = new ListConfigsQuery(repo);
  const deleteUseCase = new DeleteConfigUseCase(repo);

  const controller = new ConfigController(getQuery, setUseCase, listQuery, deleteUseCase);
  const router = createConfigRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'config-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/config', router);
  app.use('/api/config', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, repo };
}
