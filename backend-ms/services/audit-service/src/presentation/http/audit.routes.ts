import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createAuditRouter(controller: AuditController): Router {
  const router = Router();

  router.post('/logs', controller.record);
  router.get('/logs', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.query);
  router.get('/config', controller.getConfig);
  router.get('/grafana/annotations', controller.getAnnotations);

  return router;
}
