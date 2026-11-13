import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';
import { requireTenant } from '../../shared/presentation/tenant.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  router.post('/register', requireTenant(), controller.register);
  router.post('/login', requireTenant(), controller.login);
  router.post('/refresh', controller.refresh);
  router.get('/profile', requireAuth, requireTenant(), controller.getProfile);
  router.get('/users/:id', requireAuth, requireTenant(), requireRole(['ADMIN', 'SUPPORT']), controller.getUser);

  return router;
}
