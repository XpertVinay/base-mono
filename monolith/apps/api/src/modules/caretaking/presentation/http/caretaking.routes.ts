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

  // Terminate assignment (FR-ASG-010 Instant Revocation)
  router.post('/assignments/:id/terminate', controller.terminateAssignment);
  router.delete('/assignments/:id', controller.terminateAssignment);

  // List assignments
  router.get('/assignments', controller.listAssignments);

  // Get single assignment
  router.get('/assignments/:id', controller.getAssignment);

  return router;
}
