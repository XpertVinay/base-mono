import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresAuditRepository } from './infrastructure/persistence/postgres-audit.repository.js';
import { RecordAuditLogUseCase, QueryAuditLogsQuery } from './application/use-cases/audit.use-cases.js';
import { AuditController } from './presentation/http/audit.controller.js';
import { createAuditRouter } from './presentation/http/audit.routes.js';

export function createApp(): {
  app: Express;
  recordUseCase: RecordAuditLogUseCase;
  queryUseCase: QueryAuditLogsQuery;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const repo = new PostgresAuditRepository();
  const recordUseCase = new RecordAuditLogUseCase(repo);
  const queryUseCase = new QueryAuditLogsQuery(repo);

  const controller = new AuditController(recordUseCase, queryUseCase);
  const router = createAuditRouter(controller);

  // Health and Metrics endpoints
  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'audit-service', timestamp: new Date().toISOString() }));
  app.get('/metrics', controller.getMetrics);

  app.use('/api/v1/audit', router);
  app.use('/api/audit', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, recordUseCase, queryUseCase };
}
