import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresOrderRepository } from './infrastructure/persistence/postgres-order.repository.js';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery
} from './application/commands/order.commands.js';
import { OrderController } from './presentation/http/order.controller.js';
import { createOrderRouter } from './presentation/http/order.routes.js';
import { InventoryGrpcClient } from './grpc/inventory-grpc.client.js';

export function createApp(): {
  app: Express;
  repo: PostgresOrderRepository;
  createUseCase: CreateOrderUseCase;
  cancelUseCase: CancelOrderUseCase;
  getByIdQuery: GetOrderByIdQuery;
  listMyQuery: ListMyOrdersQuery;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const repo = new PostgresOrderRepository();
  const inventoryClient = new InventoryGrpcClient();

  const createUseCase = new CreateOrderUseCase(repo, inventoryClient);
  const cancelUseCase = new CancelOrderUseCase(repo, inventoryClient);
  const getByIdQuery = new GetOrderByIdQuery(repo);
  const listMyQuery = new ListMyOrdersQuery(repo);

  const controller = new OrderController(createUseCase, cancelUseCase, getByIdQuery, listMyQuery);
  const router = createOrderRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'order-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/orders', router);
  app.use('/api/orders', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, repo, createUseCase, cancelUseCase, getByIdQuery, listMyQuery };
}
