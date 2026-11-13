import { Router } from 'express';
import { PermissionController } from './permission.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createPermissionRouter(controller: PermissionController): Router {
  const router = Router();

  // Public / authenticated routes
  router.get('/', controller.list);
  router.get('/categories', controller.categories);
  router.get('/:id', controller.getById);

  // Administrative mutations
  router.post('/', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.create);
  router.put('/:id', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.update);
  router.delete('/:id', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.delete);

  return router;
}

