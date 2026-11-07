import { Router } from 'express';
import { TransactionController } from './transaction.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createTransactionRouter(controller: TransactionController): Router {
  const router = Router();

  // Public Gateway endpoints (no JWT needed for incoming webhooks from Stripe/PayPal/Razorpay and hosted checkout simulator)
  router.post('/webhooks/:provider', controller.handleWebhook);
  router.get('/gateway-simulator', controller.renderGatewaySimulator);

  // Protected User endpoints
  router.use(authenticate);
  router.post('/initiate', controller.initiate);
  router.post('/pay', controller.pay);
  router.get('/my', controller.listMyTransactions);
  router.get('/tenant', controller.listTenantTransactions);
  router.get('/gateways', controller.getGateways);
  router.get('/:id', controller.getTransaction);
  router.post('/:id/refund', controller.refund);

  return router;
}
