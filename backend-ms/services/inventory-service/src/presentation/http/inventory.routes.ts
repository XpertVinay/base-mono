import { Router } from 'express';
import { InventoryController } from './inventory.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createInventoryRouter(controller: InventoryController): Router {
  const router = Router();

  // Stock operations
  router.post('/reserve', requireAuth, controller.reserve);
  router.post('/release', requireAuth, controller.release);
  router.post('/stock', requireAuth, requireRole(['ADMIN']), controller.addStock);

  // Backoffice item CRUD
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.createItem);
  router.get('/:productId', controller.getStock);
  router.put('/:productId', requireAuth, requireRole(['ADMIN']), controller.updateItem);
  router.patch('/:productId', requireAuth, requireRole(['ADMIN']), controller.updateItem);
  router.delete('/:productId', requireAuth, requireRole(['ADMIN']), controller.deleteItem);

  // Explicit backoffice path aliases
  router.get('/backoffice/items', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/backoffice/items', requireAuth, requireRole(['ADMIN']), controller.createItem);
  router.get('/backoffice/items/:productId', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getStock);
  router.put('/backoffice/items/:productId', requireAuth, requireRole(['ADMIN']), controller.updateItem);
  router.patch('/backoffice/items/:productId', requireAuth, requireRole(['ADMIN']), controller.updateItem);
  router.delete('/backoffice/items/:productId', requireAuth, requireRole(['ADMIN']), controller.deleteItem);

  return router;
}
