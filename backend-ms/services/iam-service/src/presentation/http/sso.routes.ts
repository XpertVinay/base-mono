import { Router } from 'express';
import { SsoController } from './sso.controller.js';
import { requireAuth } from '../../shared/presentation/auth.middleware.js';
import { requireTenant } from '../../shared/presentation/tenant.middleware.js';

export function createSsoRouter(controller: SsoController): Router {
  const router = Router();

  router.post('/handoff', requireAuth, requireTenant(), controller.createHandoff);
  router.post('/redeem', requireTenant(), controller.redeemHandoff);
  router.post('/exchange', requireAuth, requireTenant(), controller.exchangeForService);
  router.post('/introspect', controller.introspect);
  router.get('/sessions', requireAuth, requireTenant(), controller.listMySessions);
  router.post('/logout', requireAuth, requireTenant(), controller.logout);

  return router;
}

