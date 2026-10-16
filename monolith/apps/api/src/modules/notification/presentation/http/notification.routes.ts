import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();

  router.get('/', authenticate, controller.list);
  router.post('/', authenticate, controller.send);

  return router;
}
