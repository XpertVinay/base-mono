import { Router } from 'express';
import { IamController } from './iam.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';
import { authRateLimiter } from '../../../../shared/presentation/rate-limiter.middleware.js';

export function createIamRouter(controller: IamController): Router {
  const router = Router();

  // Basic IAM
  router.post('/register', authRateLimiter, controller.register);
  router.post('/login', authRateLimiter, controller.login);
  router.post('/refresh', authRateLimiter, controller.refresh);
  router.get('/me', authenticate, controller.me);

  // Asymmetric Cryptography & OpenID Connect JWKS Endpoints (Public)
  router.get('/.well-known/jwks.json', controller.getJwks);
  router.get('/jwks', controller.getJwks);
  router.get('/public-key', controller.getPublicKey);

  // MFA Flow Endpoints
  router.post('/mfa/setup', authenticate, controller.setupMfa);
  router.post('/mfa/enable', authenticate, controller.enableMfa);
  router.post('/mfa/verify', authRateLimiter, controller.verifyMfa);
  router.post('/mfa/reverify', authenticate, controller.reverifyMfa);
  router.post('/mfa/disable', authenticate, controller.disableMfa);
  router.get('/mfa/status', authenticate, controller.getMfaStatus);

  // Database-Configured MFA Protected Routes Management (Admin Only)
  router.get('/mfa/protected-routes', authenticate, requireRole('ADMIN'), controller.listProtectedRoutes);
  router.post('/mfa/protected-routes', authenticate, requireRole('ADMIN'), controller.addProtectedRoute);
  router.delete('/mfa/protected-routes/:id', authenticate, requireRole('ADMIN'), controller.deleteProtectedRoute);

  // SSO Flow Endpoints
  router.post('/sso/initiate', authRateLimiter, controller.ssoInitiate);
  router.post('/sso/callback', authRateLimiter, controller.ssoCallback);

  // Audit Logs (Admin & Auditor)
  router.get('/audit-logs', authenticate, requireRole('ADMIN', 'AUDITOR'), controller.getAuditLogs);

  return router;
}
