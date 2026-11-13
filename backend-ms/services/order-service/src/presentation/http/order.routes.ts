import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createOrderRouter(controller: OrderController): Router {
  const router = Router();

  // User-scoped routes
  router.post('/', requireAuth, controller.create);
  router.get('/my', requireAuth, controller.listMyOrders);
  router.post('/:id/cancel', requireAuth, controller.cancel);

  // Backoffice order CRUD & Status Lifecycle
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.get('/:id', requireAuth, controller.getById);
  router.put('/:id', requireAuth, requireRole(['ADMIN']), controller.updateOrder);
  router.patch('/:id', requireAuth, requireRole(['ADMIN']), controller.updateOrder);
  router.patch('/:id/status', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.updateStatus);
  router.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.deleteOrder);

  // Explicit backoffice path aliases
  router.get('/backoffice/orders', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/backoffice/orders', requireAuth, requireRole(['ADMIN']), controller.create);
  router.get('/backoffice/orders/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/backoffice/orders/:id', requireAuth, requireRole(['ADMIN']), controller.updateOrder);
  router.patch('/backoffice/orders/:id', requireAuth, requireRole(['ADMIN']), controller.updateOrder);
  router.patch('/backoffice/orders/:id/status', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.updateStatus);
  router.delete('/backoffice/orders/:id', requireAuth, requireRole(['ADMIN']), controller.deleteOrder);

  return router;
}
