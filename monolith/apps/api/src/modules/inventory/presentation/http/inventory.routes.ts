import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.post('/reserve', authenticate, controller.reserve);

  return router;
}
