import { Router } from 'express';
import { OidcController } from './oidc.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';
import { requireTenant } from '../../shared/presentation/tenant.middleware.js';

export function createOidcRouter(controller: OidcController): Router {
  const router = Router();

  // Public discovery & OIDC/OAuth2/SAML login & SLO endpoints
  router.get('/providers', requireTenant(), controller.listPublicProviders);
  router.post('/authorize', requireTenant(), controller.authorizePost);
  router.get('/callback', controller.callback);
  router.post('/callback', controller.callback);
  router.post('/token-exchange', requireTenant(), controller.tokenExchange);
  router.get('/logout', requireAuth, requireTenant(), controller.logout);
  router.post('/logout', requireAuth, requireTenant(), controller.logout);

  // Admin provider management & platform approvals (must precede /:provider wildcard routes)
  router.get('/admin/supported-types', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listSupportedTypes);
  router.get('/admin/providers', requireAuth, requireRole(['ADMIN']), controller.adminListProviders);
  router.get('/admin/providers/pending', requireAuth, requireRole(['ADMIN']), controller.adminListPendingApprovals);
  router.post('/admin/providers', requireAuth, requireRole(['ADMIN']), controller.adminConfigureProvider);
  router.post('/admin/providers/associate', requireAuth, requireRole(['ADMIN']), controller.adminAssociateSystemProvider);
  router.patch('/admin/providers/:id', requireAuth, requireRole(['ADMIN']), controller.adminUpdateProvider);
  router.delete('/admin/providers/:id', requireAuth, requireRole(['ADMIN']), controller.adminDeleteProvider);
  router.post('/admin/providers/:id/test-discovery', requireAuth, requireRole(['ADMIN']), controller.adminTestDiscovery);
  router.post('/admin/providers/:id/approve', requireAuth, requireRole(['ADMIN']), controller.adminApproveProvider);
  router.post('/admin/providers/:id/reject', requireAuth, requireRole(['ADMIN']), controller.adminRejectProvider);

  // Provider-slug parameterized federation flow routes
  router.get('/:provider/authorize', requireTenant(), controller.authorizeGet);
  router.get('/:provider/callback', controller.callback);
  router.post('/:provider/callback', controller.callback);
  router.post('/:provider/link', requireAuth, requireTenant(), controller.initiateLink);
  router.get('/:provider/logout', requireAuth, requireTenant(), controller.logout);
  router.post('/:provider/logout', requireAuth, requireTenant(), controller.logout);
  router.post('/:provider/backchannel-logout', requireTenant(), controller.backchannelLogout);

  return router;
}

export function createFederatedIdentityRouter(controller: OidcController): Router {
  const router = Router();

  router.get('/', requireAuth, requireTenant(), controller.listMyFederatedIdentities);
  router.delete('/:id', requireAuth, requireTenant(), controller.unlinkFederatedIdentity);

  return router;
}
