import { Router } from 'express';
import { SchedulerController } from './scheduler.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createSchedulerRouter(controller: SchedulerController): Router {
  const router = Router();

  router.get('/jobs', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  router.post('/jobs', requireAuth, requireRole(['ADMIN']), controller.create);
  router.post('/jobs/:id/trigger', requireAuth, requireRole(['ADMIN']), controller.trigger);

  return router;
}
