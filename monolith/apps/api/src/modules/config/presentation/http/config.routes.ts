import { Router } from 'express';
import { ConfigController } from './config.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createConfigRouter(controller: ConfigController): Router {
  const router = Router();

  router.get('/', controller.getAll);
  router.get('/:key', controller.getByKey);
  // Modifying runtime configs requires ADMIN role
  router.post('/', authenticate, requireRole('ADMIN'), controller.set);

  return router;
}
