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

  // Backoffice notification CRUD
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  router.get('/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.patch('/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.delete);

  // Explicit backoffice path aliases
  router.get('/backoffice/notifications', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  router.post('/backoffice/notifications', requireAuth, requireRole(['ADMIN']), controller.send);
  router.get('/backoffice/notifications/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/backoffice/notifications/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.patch('/backoffice/notifications/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/backoffice/notifications/:id', requireAuth, requireRole(['ADMIN']), controller.delete);

  return router;
}
