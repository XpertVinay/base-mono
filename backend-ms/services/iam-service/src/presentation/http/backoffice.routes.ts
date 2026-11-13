import { Router } from 'express';
import { BackOfficeController } from './backoffice.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createBackOfficeRouter(controller: BackOfficeController): Router {
  const router = Router();

  // Role definitions and platform permissions
  router.get('/roles', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getRoles);

  // User management CRUD
  router.get('/users', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listUsers);
  router.post('/users', requireAuth, requireRole(['ADMIN']), controller.createUser);
  router.get('/users/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getUser);
  router.put('/users/:id', requireAuth, requireRole(['ADMIN']), controller.updateUser);
  router.patch('/users/:id', requireAuth, requireRole(['ADMIN']), controller.updateUser);
  router.patch('/users/:id/status', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.updateUserStatus);
  router.post('/users/:id/reset-password', requireAuth, requireRole(['ADMIN']), controller.resetPassword);
  router.delete('/users/:id', requireAuth, requireRole(['ADMIN']), controller.deleteUser);

  // User session inspection & revocation
  router.get('/users/:id/sessions', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listUserSessions);
  router.delete('/users/:id/sessions', requireAuth, requireRole(['ADMIN']), controller.revokeUserSessions);
  router.delete('/sessions/:sessionId', requireAuth, requireRole(['ADMIN']), controller.revokeSingleSession);

  // Tenant deletion safeguard
  router.delete('/tenants/:idOrSlug', requireAuth, requireRole(['ADMIN']), controller.deleteTenant);

  return router;
}

