import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  router.get('/:productId', controller.getStock);
  router.post('/reserve', requireAuth, controller.reserve);
  router.post('/release', requireAuth, controller.release);
  router.post('/stock', requireAuth, requireRole(['ADMIN']), controller.addStock);

  return router;
}
