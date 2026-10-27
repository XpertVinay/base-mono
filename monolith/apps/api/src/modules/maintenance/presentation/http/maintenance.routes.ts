import { Router } from 'express';
import { MaintenanceController } from './maintenance.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createMaintenanceRouter(controller: MaintenanceController): Router {
  const router = Router();

  // All endpoints require authentication
  router.use(authenticate);

  // Submit maintenance request (Tenant, Owner, Caretaker)
  router.post('/', controller.submit);

  // List maintenance requests
  router.get('/', controller.list);

  // Submit vendor quotation
  router.post('/:id/quotations', requireRole('VENDOR', 'CARETAKER', 'ADMIN'), controller.submitQuotation);

  // Approve quotation (Owner or Caretaker within limit)
  router.patch('/:id/quotations/:quotationId/approve', requireRole('OWNER', 'CARETAKER', 'ADMIN'), controller.approveQuotation);

  // Complete maintenance work with anti-fraud GPS & photo proofs
  router.post('/:id/complete', requireRole('VENDOR', 'CARETAKER', 'ADMIN'), controller.completeWork);

  return router;
}
