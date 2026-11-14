import { Router } from 'express';
import { SchedulerController } from './scheduler.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createSchedulerRouter(controller: SchedulerController): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({
      service: 'scheduler-service',
      description: 'Distributed Cron and Job Scheduling Service',
      version: '1.0.0',
      endpoints: [
        '/jobs',
        '/jobs/:id',
        '/jobs/:id/trigger',
        '/backoffice/jobs',
        '/health'
      ]
    });
  });

  // Job management CRUD
  router.get('/jobs', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  router.post('/jobs', requireAuth, requireRole(['ADMIN']), controller.create);
  router.get('/jobs/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  router.patch('/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  router.delete('/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.deleteJob);
  router.post('/jobs/:id/trigger', requireAuth, requireRole(['ADMIN']), controller.trigger);

  // Explicit backoffice path aliases
  router.get('/backoffice/jobs', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.list);
  router.post('/backoffice/jobs', requireAuth, requireRole(['ADMIN']), controller.create);
  router.get('/backoffice/jobs/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/backoffice/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  router.patch('/backoffice/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.updateJob);
  router.delete('/backoffice/jobs/:id', requireAuth, requireRole(['ADMIN']), controller.deleteJob);
  router.post('/backoffice/jobs/:id/trigger', requireAuth, requireRole(['ADMIN']), controller.trigger);

  return router;
}
