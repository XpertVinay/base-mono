import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/profile', requireAuth, controller.getProfile);
  router.get('/users/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getUser);

  return router;
}
