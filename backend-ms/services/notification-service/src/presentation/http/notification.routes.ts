import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();

  router.post('/', requireAuth, controller.send);
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);

  return router;
}
