import { Express, Router } from 'express';
import { ModuleRegistryResult } from './register-modules.js';

export function registerRoutes(app: Express, registry: ModuleRegistryResult): void {
  const { routers, gatewayController } = registry;

  // Liveness and Readiness Health Probes
  app.get('/health', gatewayController.ready);
  app.get('/health/live', gatewayController.live);
  app.get('/health/ready', gatewayController.ready);

  // Business Modules API Prefixes
  const apiRouter = Router();

  apiRouter.use('/iam', routers.iam);
  apiRouter.use('/assets', routers.asset);
  apiRouter.use('/config', routers.config);
  apiRouter.use('/notifications', routers.notification);
  apiRouter.use('/scheduler', routers.scheduler);
  apiRouter.use('/orders', routers.order);
  apiRouter.use('/transactions', routers.transaction);
  apiRouter.use('/search', routers.search);
  apiRouter.use('/inventory', routers.inventory);
  apiRouter.use('/gateway', routers.gateway);

  app.use('/api', apiRouter);
}
