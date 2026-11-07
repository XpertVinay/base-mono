import { Router } from 'express';
import { SearchController } from './search.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createSearchRouter(controller: SearchController): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/', controller.search);
  router.get('/:id', controller.getById);
  router.post('/index', controller.index);
  router.delete('/:id', controller.delete);

  return router;
}
