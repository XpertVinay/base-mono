import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { requireAuth, requireRole } from './shared/presentation/auth.middleware.js';
import { PostgresSchedulerRepository } from './infrastructure/persistence/postgres-scheduler.repository.js';
import { ISchedulerRepository } from './domain/repositories/scheduler-repository.interface.js';
import {
  CreateJobUseCase,
  ListJobsQuery,
  TriggerJobUseCase
} from './application/use-cases/scheduler.use-cases.js';
import {
  GetJobByIdQuery,
  UpdateJobUseCase,
  DeleteJobUseCase
} from './application/use-cases/backoffice-scheduler.use-cases.js';
import { SchedulerController } from './presentation/http/scheduler.controller.js';
import { createSchedulerRouter } from './presentation/http/scheduler.routes.js';
import { logger } from './shared/infrastructure/logger.js';

export function createApp(customRepo?: ISchedulerRepository): {
  app: Express;
  listQuery: ListJobsQuery;
  createUseCase: CreateJobUseCase;
  triggerUseCase: TriggerJobUseCase;
  getByIdQuery: GetJobByIdQuery;
  updateUseCase: UpdateJobUseCase;
  deleteUseCase: DeleteJobUseCase;
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

  const repo = customRepo || new PostgresSchedulerRepository();
  const tasks = new Map<string, () => Promise<void>>();

  tasks.set('SYSTEM_HEARTBEAT', async () => {
    logger.info('Scheduler heartbeat check executed.');
  });

  const listQuery = new ListJobsQuery(repo);
  const createUseCase = new CreateJobUseCase(repo);
  const triggerUseCase = new TriggerJobUseCase(repo, tasks);
  const getByIdQuery = new GetJobByIdQuery(repo);
  const updateUseCase = new UpdateJobUseCase(repo);
  const deleteUseCase = new DeleteJobUseCase(repo);

  const controller = new SchedulerController(
    listQuery,
    createUseCase,
    triggerUseCase,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  );
  const router = createSchedulerRouter(controller);

  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({
      status: 'ok',
      service: 'scheduler-service',
      timestamp: new Date().toISOString()
    });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/scheduler/health',
      '/api/scheduler/health'
    ],
    healthHandler
  );

  // Canonical Back-Office Routes (Feature F12)
  const backofficeJobsRouter = express.Router();
  backofficeJobsRouter.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  backofficeJobsRouter.post('/', requireAuth, requireRole(['ADMIN']), controller.create);
  backofficeJobsRouter.get('/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  backofficeJobsRouter.put('/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  backofficeJobsRouter.patch('/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  backofficeJobsRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.deleteJob);
  backofficeJobsRouter.post('/:id/trigger', requireAuth, requireRole(['ADMIN']), controller.trigger);

  app.use('/api/v1/backoffice/jobs', backofficeJobsRouter);
  app.use('/api/backoffice/jobs', backofficeJobsRouter);
  app.use('/api/v1/backoffice/scheduler', router);
  app.use('/api/backoffice/scheduler', router);
  app.use('/api/v1/backoffice', router);
  app.use('/api/backoffice', router);

  app.use('/api/v1/scheduler', router);
  app.use('/api/scheduler', router);
  app.use('/api/v1/scheduler/backoffice', router);
  app.use('/api/scheduler/backoffice', router);
  app.use('/api/v1/scheduler/admin', router);
  app.use('/api/scheduler/admin', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return {
    app,
    listQuery,
    createUseCase,
    triggerUseCase,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  };
}
