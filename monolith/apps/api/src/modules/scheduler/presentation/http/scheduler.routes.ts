import { Router } from 'express';
import { SchedulerController } from './scheduler.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createSchedulerRouter(controller: SchedulerController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.get('/:id/runs', controller.listRuns);
  router.post('/', requireRole('ADMIN'), controller.create);
  router.post('/:id/trigger', requireRole('ADMIN'), controller.trigger);

  return router;
}
