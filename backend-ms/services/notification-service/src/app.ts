import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresNotificationRepository } from './infrastructure/persistence/postgres-notification.repository.js';
import { INotificationRepository } from './domain/repositories/notification-repository.interface.js';
import { SendNotificationUseCase, ListNotificationsQuery } from './application/use-cases/notification.use-cases.js';
import {
  ListAllNotificationsQuery,
  GetNotificationByIdQuery,
  UpdateNotificationUseCase,
  DeleteNotificationUseCase
} from './application/use-cases/backoffice-notification.use-cases.js';
import { NotificationController } from './presentation/http/notification.controller.js';
import { createNotificationRouter } from './presentation/http/notification.routes.js';

export function createApp(customRepo?: INotificationRepository): {
  app: Express;
  sendUseCase: SendNotificationUseCase;
  listQuery: ListNotificationsQuery;
  listAllQuery: ListAllNotificationsQuery;
  getByIdQuery: GetNotificationByIdQuery;
  updateUseCase: UpdateNotificationUseCase;
  deleteUseCase: DeleteNotificationUseCase;
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

  const repo = customRepo || new PostgresNotificationRepository();
  const sendUseCase = new SendNotificationUseCase(repo);
  const listQuery = new ListNotificationsQuery(repo);
  const listAllQuery = new ListAllNotificationsQuery(repo);
  const getByIdQuery = new GetNotificationByIdQuery(repo);
  const updateUseCase = new UpdateNotificationUseCase(repo);
  const deleteUseCase = new DeleteNotificationUseCase(repo);

  const controller = new NotificationController(
    sendUseCase,
    listQuery,
    listAllQuery,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  );
  const router = createNotificationRouter(controller);

  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString()
    });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/notifications/health',
      '/api/notifications/health',
      '/api/v1/notification/health',
      '/api/notification/health'
    ],
    healthHandler
  );

  // Canonical Back-Office Routes (Feature F12)
  app.use('/api/v1/backoffice/notifications', router);
  app.use('/api/backoffice/notifications', router);

  app.use('/api/v1/notifications', router);
  app.use('/api/notifications', router);
  app.use('/api/v1/notifications/backoffice', router);
  app.use('/api/notifications/backoffice', router);
  app.use('/api/v1/notifications/admin', router);
  app.use('/api/notifications/admin', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return {
    app,
    sendUseCase,
    listQuery,
    listAllQuery,
    getByIdQuery,
    updateUseCase,
    deleteUseCase
  };
}
