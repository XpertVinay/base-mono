import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresSchedulerRepository } from './infrastructure/persistence/postgres-scheduler.repository.js';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from './application/use-cases/scheduler.use-cases.js';
import { SchedulerController } from './presentation/http/scheduler.controller.js';
import { createSchedulerRouter } from './presentation/http/scheduler.routes.js';
import { logger } from './shared/infrastructure/logger.js';

export function createApp(): {
  app: Express;
  listQuery: ListJobsQuery;
  createUseCase: CreateJobUseCase;
  triggerUseCase: TriggerJobUseCase;
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

  const repo = new PostgresSchedulerRepository();
  const tasks = new Map<string, () => Promise<void>>();

  tasks.set('SYSTEM_HEARTBEAT', async () => {
    logger.info('Scheduler heartbeat check executed.');
  });

  const listQuery = new ListJobsQuery(repo);
  const createUseCase = new CreateJobUseCase(repo);
  const triggerUseCase = new TriggerJobUseCase(repo, tasks);

  const controller = new SchedulerController(listQuery, createUseCase, triggerUseCase);
  const router = createSchedulerRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'scheduler-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/scheduler', router);
  app.use('/api/scheduler', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, listQuery, createUseCase, triggerUseCase };
}
