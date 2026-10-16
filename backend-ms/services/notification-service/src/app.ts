import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresNotificationRepository } from './infrastructure/persistence/postgres-notification.repository.js';
import { SendNotificationUseCase, ListNotificationsQuery } from './application/use-cases/notification.use-cases.js';
import { NotificationController } from './presentation/http/notification.controller.js';
import { createNotificationRouter } from './presentation/http/notification.routes.js';

export function createApp(): { app: Express; sendUseCase: SendNotificationUseCase } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const repo = new PostgresNotificationRepository();
  const sendUseCase = new SendNotificationUseCase(repo);
  const listQuery = new ListNotificationsQuery(repo);

  const controller = new NotificationController(sendUseCase, listQuery);
  const router = createNotificationRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'notification-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/notifications', router);
  app.use('/api/notifications', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, sendUseCase };
}
