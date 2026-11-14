import { Router } from 'express';
import { AssetController } from './asset.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createAssetRouter(controller: AssetController): Router {
  const router = Router();

  // User-scoped routes
  router.post('/', requireAuth, controller.create);
  router.get('/my', requireAuth, controller.listMyAssets);

  // Backoffice & Administrative asset CRUD
  router.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.get('/:id', requireAuth, controller.getById);
  router.put('/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.patch('/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.delete);

  // Explicit backoffice path aliases
  router.get('/backoffice/assets', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listAll);
  router.post('/backoffice/assets', requireAuth, requireRole(['ADMIN']), controller.create);
  router.get('/backoffice/assets/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getById);
  router.put('/backoffice/assets/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.patch('/backoffice/assets/:id', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/backoffice/assets/:id', requireAuth, requireRole(['ADMIN']), controller.delete);

  return router;
}
