import { Router, raw } from 'express';
import { AssetController } from './asset.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createAssetRouter(controller: AssetController): Router {
  const router = Router();

  // Local storage provider direct upload simulation endpoint
  router.put('/local-upload/*', raw({ type: '*/*', limit: '30mb' }), controller.handleLocalUpload);

  // Require authentication for all asset operations
  router.use(authenticate);

  router.post('/presign-upload', controller.presignUpload);
  router.post('/:id/confirm', controller.confirm);
  router.get('/my', controller.listMyAssets);
  router.get('/:id', controller.getById);
  router.delete('/:id', controller.delete);
  router.get('/', controller.listTenantAssets);
  router.post('/', controller.create);

  return router;
}
