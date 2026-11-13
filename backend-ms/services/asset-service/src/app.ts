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
import {
  ListAllAssetsQuery,
  GetAssetByIdQuery,
  UpdateAssetUseCase,
  DeleteAssetUseCase
} from './application/commands/backoffice-asset.use-cases.js';
import { AssetController } from './presentation/http/asset.controller.js';
import { createAssetRouter } from './presentation/http/asset.routes.js';
import { IAssetRepository } from './domain/repositories/asset-repository.interface.js';

export function createApp(customRepo?: IAssetRepository): {
  app: Express;
  createUseCase: CreateAssetUseCase;
  listQuery: ListAssetsQuery;
  listAllQuery: ListAllAssetsQuery;
  getByIdQuery: GetAssetByIdQuery;
  updateUseCase: UpdateAssetUseCase;
  deleteUseCase: DeleteAssetUseCase;
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

  const repo = customRepo || new PostgresAssetRepository();
  const createUseCase = new CreateAssetUseCase(repo);
  const listQuery = new ListAssetsQuery(repo);
  const listAllQuery = new ListAllAssetsQuery(repo);
  const getByIdQuery = new GetAssetByIdQuery(repo);
  const updateUseCase = new UpdateAssetUseCase(repo);
  const deleteUseCase = new DeleteAssetUseCase(repo);

  const controller = new AssetController(
    createUseCase,
    listQuery,
    listAllQuery,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  );
  const router = createAssetRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'asset-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/assets', router);
  app.use('/api/assets', router);
  app.use('/api/v1/assets/backoffice', router);
  app.use('/api/assets/backoffice', router);
  app.use('/api/v1/assets/admin', router);
  app.use('/api/assets/admin', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return {
    app,
    createUseCase,
    listQuery,
    listAllQuery,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  };
}
