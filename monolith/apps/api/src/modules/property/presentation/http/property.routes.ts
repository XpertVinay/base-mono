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

  // Units
  router.post('/:id/units', requireRole('OWNER', 'ADMIN'), controller.createUnit);
  router.get('/:id/units', controller.listUnits);
  router.patch('/units/:unitId/status', requireRole('OWNER', 'ADMIN'), controller.updateUnitStatus);

  // Ownership Splits
  router.post('/:id/ownership-splits', requireRole('OWNER', 'ADMIN'), controller.setOwnershipSplits);
  router.get('/:id/ownership-splits', controller.getOwnershipSplits);

  return router;
}
