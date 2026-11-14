import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresInventoryRepository } from './infrastructure/persistence/postgres-inventory.repository.js';
import { IInventoryRepository } from './domain/repositories/inventory-repository.interface.js';
import {
  ReserveInventoryUseCase,
  ReleaseInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from './application/use-cases/inventory.use-cases.js';
import {
  ListAllInventoryQuery,
  CreateInventoryItemUseCase,
  UpdateInventoryItemUseCase,
  DeleteInventoryItemUseCase
} from './application/use-cases/backoffice-inventory.use-cases.js';
import { InventoryController } from './presentation/http/inventory.controller.js';
import { createInventoryRouter } from './presentation/http/inventory.routes.js';

export function createApp(customRepo?: IInventoryRepository): { app: Express; repo: IInventoryRepository } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const repo = customRepo || new PostgresInventoryRepository();
  const reserveUseCase = new ReserveInventoryUseCase(repo);
  const releaseUseCase = new ReleaseInventoryUseCase(repo);
  const addStockUseCase = new AddStockUseCase(repo);
  const getStockQuery = new GetStockQuery(repo);
  const listAllQuery = new ListAllInventoryQuery(repo);
  const createItemUseCase = new CreateInventoryItemUseCase(repo);
  const updateItemUseCase = new UpdateInventoryItemUseCase(repo);
  const deleteItemUseCase = new DeleteInventoryItemUseCase(repo);

  const controller = new InventoryController(
    reserveUseCase,
    addStockUseCase,
    getStockQuery,
    releaseUseCase,
    listAllQuery,
    createItemUseCase,
    updateItemUseCase,
    deleteItemUseCase
  );
  const router = createInventoryRouter(controller);

  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({
      status: 'ok',
      service: 'inventory-service',
      timestamp: new Date().toISOString()
    });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/inventory/health',
      '/api/inventory/health'
    ],
    healthHandler
  );

  // Canonical Back-Office Routes (Feature F12)
  app.use('/api/v1/backoffice/inventory', router);
  app.use('/api/backoffice/inventory', router);
  app.use('/api/v1/backoffice/items', router);
  app.use('/api/backoffice/items', router);

  app.use('/api/v1/inventory', router);
  app.use('/api/inventory', router);
  app.use('/api/v1/inventory/backoffice', router);
  app.use('/api/inventory/backoffice', router);
  app.use('/api/v1/inventory/admin', router);
  app.use('/api/inventory/admin', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, repo };
}
