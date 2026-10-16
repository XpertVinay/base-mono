import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { requireAuth } from '../../shared/presentation/auth.middleware.js';

export function createOrderRouter(controller: OrderController): Router {
  const router = Router();

  router.post('/', requireAuth, controller.create);
  router.get('/my', requireAuth, controller.listMyOrders);
  router.get('/:id', requireAuth, controller.getById);
  router.post('/:id/cancel', requireAuth, controller.cancel);

  return router;
}
