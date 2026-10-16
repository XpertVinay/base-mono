import { Router } from 'express';
import { AssetController } from './asset.controller.js';
import { requireAuth } from '../../shared/presentation/auth.middleware.js';

export function createAssetRouter(controller: AssetController): Router {
  const router = Router();

  router.post('/', requireAuth, controller.create);
  router.get('/my', requireAuth, controller.listMyAssets);

  return router;
}
