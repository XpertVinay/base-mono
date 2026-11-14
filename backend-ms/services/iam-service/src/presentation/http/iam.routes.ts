import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';
import { requireTenant } from '../../shared/presentation/tenant.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({
      service: 'iam-service',
      description: 'Identity & Access Management, SSO and Multi-Tenancy Service',
      version: '1.0.0',
      endpoints: [
        '/register',
        '/login',
        '/refresh',
        '/profile',
        '/users/:id',
        '/tenants',
        '/oidc',
        '/sso',
        '/federated-identities',
        '/backoffice',
        '/health'
      ]
    });
  });

  router.get('/.well-known/jwks.json', controller.getJwks);
  router.get('/jwks', controller.getJwks);
  router.post('/register', requireTenant(), controller.register);
  router.post('/login', requireTenant(), controller.login);
  router.post('/refresh', controller.refresh);
  router.get('/profile', requireAuth, requireTenant(), controller.getProfile);
  router.get('/users/:id', requireAuth, requireTenant(), requireRole(['ADMIN', 'SUPPORT']), controller.getUser);

  return router;
}
