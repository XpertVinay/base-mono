import { Router } from 'express';
import { FinanceController } from './finance.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createFinanceRouter(controller: FinanceController): Router {
  const router = Router();

  // All financial ledger operations require authentication
  router.use(authenticate);

  // Record an expense / invoice
  router.post('/', controller.create);

  // Approve expense (Owners, Admins only)
  router.patch('/:id/approve', requireRole('OWNER', 'ADMIN'), controller.approve);

  // Settle expense payout (Admins, Owners only)
  router.post('/:id/settle', requireRole('OWNER', 'ADMIN'), controller.settle);

  // List expenses
  router.get('/', controller.list);

  return router;
}
