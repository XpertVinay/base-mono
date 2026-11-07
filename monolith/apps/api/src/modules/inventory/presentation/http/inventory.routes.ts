import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  // Inventory item queries
  router.get('/', controller.list);
  router.get('/items', controller.list);
  router.get('/items/:productId', authenticate, controller.getById);

  // Stock mutation & reservation lifecycle
  router.post('/items', authenticate, controller.create);
  router.post('/reserve', authenticate, controller.reserve);
  router.post('/release', authenticate, controller.release);
  router.post('/commit', authenticate, controller.commit);

  return router;
}
