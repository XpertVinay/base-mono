import { Router } from 'express';
import { GatewayController } from './gateway.controller.js';

export function createGatewayRouter(controller: GatewayController): Router {
  const router = Router();
  router.get('/routes', controller.routes);
  router.get('/health', controller.ready);
  return router;
}
