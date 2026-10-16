import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createOrderRouter(controller: OrderController): Router {
  const router = Router();
  router.use(authenticate);

  router.post('/', controller.create);
  router.get('/my', controller.listMyOrders);
  router.get('/:id', controller.getById);
  router.post('/:id/cancel', controller.cancel);

  return router;
}
