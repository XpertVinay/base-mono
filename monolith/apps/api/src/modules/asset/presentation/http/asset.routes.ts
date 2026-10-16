import { Router } from 'express';
import { AssetController } from './asset.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createAssetRouter(controller: AssetController): Router {
  const router = Router();
  router.use(authenticate); // Require authentication for all asset endpoints

  router.post('/', controller.create);
  router.get('/my', controller.listMyAssets);

  return router;
}
