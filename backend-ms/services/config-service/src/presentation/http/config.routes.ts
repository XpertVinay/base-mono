import { Router } from 'express';
import { ConfigController } from './config.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createConfigRouter(controller: ConfigController): Router {
  const router = Router();

  router.get('/', controller.getAll);
  router.get('/:key', controller.getByKey);
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.set);
  router.put('/:key', requireAuth, requireRole(['ADMIN']), controller.set);
  router.delete('/:key', requireAuth, requireRole(['ADMIN']), controller.delete);

  return router;
}
