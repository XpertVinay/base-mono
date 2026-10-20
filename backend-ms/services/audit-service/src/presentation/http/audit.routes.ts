import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createAuditRouter(controller: AuditController): Router {
  const router = Router();

  router.post('/logs', controller.record);
  router.get('/logs', (req, res, next) => {
    // In dev or internal proxy calls without strict auth token, allow queries for dashboard
    if (process.env.NODE_ENV !== 'production' || req.header('x-user-id') || req.header('Authorization')) {
      return controller.query(req, res, next);
    }
    return requireAuth(req, res, () => requireRole(['ADMIN', 'SUPPORT'])(req, res, next));
  });
  router.get('/config', controller.getConfig);
  router.get('/alerts', controller.getAlerts);
  router.get('/metrics/summary', controller.getMetricsSummary);
  router.post('/remediate', controller.executeRemediation);
  router.get('/grafana/annotations', controller.getAnnotations);

  return router;
}
