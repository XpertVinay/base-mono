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

  // =========================================================================
  // Multi-Tenant Organization Management Routes (Sprint 03)
  // =========================================================================

  // Current User's Organizations
  router.get('/me/organizations', authenticate, controller.listUserOrganizations);

  // Organization Registration & Lifecycle
  router.post('/organizations', authenticate, controller.createOrganization);
  router.get('/organizations/:id', authenticate, controller.getOrganization);
  router.patch('/organizations/:id', authenticate, controller.updateOrganization);
  router.patch('/organizations/:id/status', authenticate, controller.updateOrganizationStatus);
  router.get('/organizations/:id/context', authenticate, controller.getOrganizationContext);

  // Organization Memberships
  router.get('/organizations/:id/members', authenticate, controller.listOrganizationMembers);
  router.patch('/organizations/:id/members/:userId', authenticate, controller.updateMembership);
  router.delete('/organizations/:id/members/:userId', authenticate, controller.removeMember);

  // Organization Invitations
  router.post('/organizations/:id/invitations', authenticate, controller.inviteMember);
  router.get('/organizations/:id/invitations', authenticate, controller.listInvitations);
  router.post('/invitations/:token/accept', authenticate, controller.acceptInvitation);
  router.post('/invitations/:token/reject', controller.rejectInvitation);

  // Membership Requests (Join Requests)
  router.post('/organizations/:id/join-requests', authenticate, controller.requestMembership);
  router.post('/organizations/:id/join-requests/:userId/approve', authenticate, controller.approveJoinRequest);
  router.post('/organizations/:id/join-requests/:userId/reject', authenticate, controller.rejectJoinRequest);

  // =========================================================================
  // Dynamic Role-Based Access Control (RBAC) & Tenant Permissions (Sprint 04)
  // =========================================================================

  // Tenant Roles Management
  router.get('/organizations/:id/roles', authenticate, controller.listTenantRoles);
  router.post('/organizations/:id/roles', authenticate, controller.createTenantRole);
  router.get('/organizations/:id/roles/:roleId', authenticate, controller.getTenantRole);
  router.put('/organizations/:id/roles/:roleId/permissions', authenticate, controller.updateRolePermissions);
  router.delete('/organizations/:id/roles/:roleId', authenticate, controller.deleteTenantRole);

  // Member Role Assignment
  router.post('/organizations/:id/members/:userId/role', authenticate, controller.assignMemberRole);

  // Effective Permissions for Current User
  router.get('/organizations/:id/my-permissions', authenticate, controller.getMyPermissions);

  return router;
}
