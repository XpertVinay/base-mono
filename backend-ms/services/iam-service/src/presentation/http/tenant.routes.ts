import { Router } from 'express';
import { TenantController } from './tenant.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createTenantRouter(controller: TenantController): Router {
  const router = Router();

  router.get('/config', controller.getMultiTenancyStatus);
  router.get('/', requireAuth, requireRole(['ADMIN']), controller.list);
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.create);
  router.post('/onboard', requireAuth, requireRole(['ADMIN']), controller.onboard);
  router.get('/:idOrSlug', requireAuth, controller.getOne);
  router.patch('/:idOrSlug', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/:idOrSlug', requireAuth, requireRole(['ADMIN']), controller.delete);

  return router;
}
