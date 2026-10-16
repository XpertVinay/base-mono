import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresInventoryRepository } from './infrastructure/persistence/postgres-inventory.repository.js';
import {
  ReserveInventoryUseCase,
  AddStockUseCase,
  GetStockQuery
} from './application/use-cases/inventory.use-cases.js';
import { InventoryController } from './presentation/http/inventory.controller.js';
import { createInventoryRouter } from './presentation/http/inventory.routes.js';

export function createApp(): { app: Express; repo: PostgresInventoryRepository } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const repo = new PostgresInventoryRepository();
  const reserveUseCase = new ReserveInventoryUseCase(repo);
  const addStockUseCase = new AddStockUseCase(repo);
  const getStockQuery = new GetStockQuery(repo);

  const controller = new InventoryController(reserveUseCase, addStockUseCase, getStockQuery);
  const router = createInventoryRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'inventory-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/inventory', router);
  app.use('/api/inventory', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, repo };
}
