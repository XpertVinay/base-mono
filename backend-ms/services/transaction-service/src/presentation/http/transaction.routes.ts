import { Router } from 'express';
import { TransactionController } from './transaction.controller.js';
import { requireAuth } from '../../shared/presentation/auth.middleware.js';

export function createTransactionRouter(controller: TransactionController): Router {
  const router = Router();

  router.post('/initiate', requireAuth, controller.initiate);
  router.post('/webhook', controller.handleWebhook);
  router.get('/:id', requireAuth, controller.getById);

  return router;
}
