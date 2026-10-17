import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';
import { authRateLimiter } from '../../../../shared/presentation/rate-limiter.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  router.post('/register', authRateLimiter, controller.register);
  router.post('/login', authRateLimiter, controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
