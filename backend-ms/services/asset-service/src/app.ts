import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresAssetRepository } from './infrastructure/persistence/postgres-asset.repository.js';
import { CreateAssetUseCase } from './application/commands/create-asset.use-case.js';
import { ListAssetsQuery } from './application/queries/list-assets.query.js';
import { AssetController } from './presentation/http/asset.controller.js';
import { createAssetRouter } from './presentation/http/asset.routes.js';

export function createApp(): {
  app: Express;
  createUseCase: CreateAssetUseCase;
  listQuery: ListAssetsQuery;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const repo = new PostgresAssetRepository();
  const createUseCase = new CreateAssetUseCase(repo);
  const listQuery = new ListAssetsQuery(repo);

  const controller = new AssetController(createUseCase, listQuery);
  const router = createAssetRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'asset-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/assets', router);
  app.use('/api/assets', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, createUseCase, listQuery };
}
