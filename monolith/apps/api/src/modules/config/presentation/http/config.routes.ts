import { Router } from 'express';
import { ConfigController } from './config.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createConfigRouter(controller: ConfigController): Router {
  const router = Router();

  // 1. Public client-facing endpoints for FE bootstrapping (strictly sanitized, non-confidential flags only)
  router.get('/client', controller.getClientConfigs);
  router.get('/public', controller.getClientConfigs);

  // 2. Authentication & RBAC Authorization Barrier
  // Protect all internal/tenant/section configuration APIs against unauthenticated access
  router.use(authenticate);

  // 3. Encrypted PII Tenant Context Token Generation (Protected on the fly & in transit)
  router.post('/context/token', controller.createContextToken);

  // 4. Modular Section endpoints (Admin protected with strict UUID tenant boundary validation)
  router.get('/sections', requireRole('ADMIN'), controller.getSectionsSummary);
  router.get('/sections/:section', requireRole('ADMIN'), controller.getSection);
  router.put('/sections/:section', requireRole('ADMIN'), controller.updateSection);
  router.post('/sections/:section', requireRole('ADMIN'), controller.updateSection);

  // 4. In-Memory Cache management endpoints (Admin only)
  router.get('/cache/stats', requireRole('ADMIN'), controller.getCacheStats);
  router.post('/cache/invalidate', requireRole('ADMIN'), controller.invalidateCache);

  // 5. Raw runtime key-value configuration endpoints (Admin only)
  router.get('/', requireRole('ADMIN'), controller.getAll);
  router.get('/:key', requireRole('ADMIN'), controller.getByKey);
  router.post('/', requireRole('ADMIN'), controller.set);

  return router;
}
