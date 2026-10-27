import { Router } from 'express';
import { CaretakingController } from './caretaking.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createCaretakingRouter(controller: CaretakingController): Router {
  const router = Router();

  // All endpoints require authentication
  router.use(authenticate);

  // Onboard as caretaker
  router.post('/onboard', requireRole('CARETAKER', 'ADMIN', 'USER'), controller.onboard);

  // List verified caretakers
  router.get('/profiles', controller.listCaretakers);

  // Assign caretaker to property (Owners only)
  router.post('/assign', requireRole('OWNER', 'ADMIN'), controller.assign);

  // Accept assignment (Caretakers only)
  router.post('/assignments/:id/accept', requireRole('CARETAKER', 'ADMIN'), controller.acceptAssignment);

  // Update permissions & spending threshold (Owners only)
  router.patch('/assignments/:id/permissions', requireRole('OWNER', 'ADMIN'), controller.updatePermissions);

  // List assignments
  router.get('/assignments', controller.listAssignments);

  return router;
}
