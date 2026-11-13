import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresTransactionRepository } from './infrastructure/persistence/postgres-transaction.repository.js';
import { ConfigGrpcClient } from './grpc/config-grpc.client.js';
import {
  InitiatePaymentUseCase,
  CompletePaymentUseCase,
  GetTransactionByIdQuery
} from './application/use-cases/transaction.use-cases.js';
import { TransactionController } from './presentation/http/transaction.controller.js';
import { createTransactionRouter } from './presentation/http/transaction.routes.js';

export function createApp(): {
  app: Express;
  initiateUseCase: InitiatePaymentUseCase;
  completeUseCase: CompletePaymentUseCase;
  getByIdQuery: GetTransactionByIdQuery;
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

  const repo = new PostgresTransactionRepository();
  const configClient = new ConfigGrpcClient();

  const initiateUseCase = new InitiatePaymentUseCase(repo, configClient);
  const completeUseCase = new CompletePaymentUseCase(repo);
  const getByIdQuery = new GetTransactionByIdQuery(repo);

  const controller = new TransactionController(initiateUseCase, completeUseCase, getByIdQuery);
  const router = createTransactionRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'transaction-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/transactions', router);
  app.use('/api/transactions', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, initiateUseCase, completeUseCase, getByIdQuery };
}
