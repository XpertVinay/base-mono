import { Router } from 'express';
import { PropertyController } from './property.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createPropertyRouter(controller: PropertyController): Router {
  const router = Router();

  // All endpoints require authentication (OWASP A01 Deny-by-Default)
  router.use(authenticate);

  // Property onboarding - Owners and Admins only
  router.post('/', requireRole('OWNER', 'ADMIN'), controller.create);

  // List properties
  router.get('/', controller.listMyProperties);

  // View property details
  router.get('/:id', controller.getById);

  // Update property status - Owners and Admins only
  router.patch('/:id/status', requireRole('OWNER', 'ADMIN'), controller.updateStatus);

  return router;
}
