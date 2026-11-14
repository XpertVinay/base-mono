import { Router } from 'express';
import { AssignmentController } from './assignment.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createAssignmentRouter(controller: AssignmentController): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({
      service: 'rbac-service',
      description: 'Role-Based Access Control and Permission Assignment Service',
      version: '1.0.0',
      endpoints: [
        '/roles',
        '/permissions',
        '/users/:userId/roles',
        '/users/:userId/permissions',
        '/users/:userId/check-permission',
        '/health'
      ]
    });
  });

  // User role queries and permission evaluation
  router.get('/users/:userId/roles', controller.getUserRoles);
  router.get('/users/:userId/permissions', controller.getUserPermissions);
  router.get('/users/:userId/check-permission', controller.checkPermission);
  router.post('/users/:userId/check-permission', controller.checkPermission);

  // Role users listing
  router.get('/roles/:id/users', controller.getRoleUsers);

  // Assignment mutations - protected by ADMIN role
  router.post('/users/:userId/roles', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.assignRole);
  router.delete('/users/:userId/roles/:roleId', requireAuth, requireRole(['ADMIN', 'SUPER_ADMIN', 'ORGANIZATION_ADMIN']), controller.revokeRole);

  return router;
}

