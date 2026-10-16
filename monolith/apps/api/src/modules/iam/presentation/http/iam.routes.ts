import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
