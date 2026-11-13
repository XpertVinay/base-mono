import { Router } from 'express';
import { TransactionController } from './transaction.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createTransactionRouter(controller: TransactionController): Router {
  const router = Router();

  // Public / Webhook
  router.post('/webhook', controller.handleWebhook);

  // User operations
  router.post('/initiate', requireAuth, controller.initiate);

  // Backoffice CRUD
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.createManual);
  router.get('/:id', requireAuth, controller.getById);
  router.put('/:id', requireAuth, requireRole(['ADMIN']), controller.updateTransaction);
  router.patch('/:id', requireAuth, requireRole(['ADMIN']), controller.updateTransaction);
  router.patch('/:id/status', requireAuth, requireRole(['ADMIN']), controller.updateStatus);
  router.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.deleteTransaction);

  // Explicit backoffice path aliases
  router.get('/backoffice/transactions', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/backoffice/transactions', requireAuth, requireRole(['ADMIN']), controller.createManual);
  router.get('/backoffice/transactions/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/backoffice/transactions/:id', requireAuth, requireRole(['ADMIN']), controller.updateTransaction);
  router.patch('/backoffice/transactions/:id', requireAuth, requireRole(['ADMIN']), controller.updateTransaction);
  router.patch('/backoffice/transactions/:id/status', requireAuth, requireRole(['ADMIN']), controller.updateStatus);
  router.delete('/backoffice/transactions/:id', requireAuth, requireRole(['ADMIN']), controller.deleteTransaction);

  return router;
}
