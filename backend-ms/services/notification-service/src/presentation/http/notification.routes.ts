import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';
import { rateLimiter } from '../../shared/presentation/rate-limiter.middleware.js';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();

  // Strict rate-limiting on message dispatch to mitigate SMS / email bombing attacks
  const notificationRateLimiter = rateLimiter({
    windowMs: 60000,
    max: 15
  });

  router.post('/', requireAuth, notificationRateLimiter, controller.send);
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);

  return router;
}
