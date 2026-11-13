import { Router } from 'express';
import { RoleController } from './role.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createRoleRouter(controller: RoleController): Router {
  const router = Router();

  // Public / authenticated routes
  router.get('/', controller.list);
  router.get('/:id', controller.getById);

  // Administrative mutations - protected by ADMIN role or internal secret
  router.post('/', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.create);
  router.put('/:id', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.update);
  router.put('/:id/permissions', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.updatePermissions);
  router.delete('/:id', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.delete);

  return router;
}

