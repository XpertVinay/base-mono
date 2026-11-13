import { Router } from 'express';
import { ConfigController } from './config.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createConfigRouter(controller: ConfigController): Router {
  const router = Router();

  // All configuration endpoints are secured: reads require authenticated identity or internal secret
  router.get('/', requireAuth, controller.getAll);
  router.get('/:key', requireAuth, controller.getByKey);

  // Administrative mutations require explicit ADMIN role
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.set);
  router.put('/:key', requireAuth, requireRole(['ADMIN']), controller.set);
  router.delete('/:key', requireAuth, requireRole(['ADMIN']), controller.delete);

  return router;
}
