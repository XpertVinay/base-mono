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

  // Database-Configured In-Memory Cached MFA Re-verification Guard
  if (registry.mfaMiddleware) {
    apiRouter.use(registry.mfaMiddleware);
  }

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
  apiRouter.use('/properties', routers.property);
  apiRouter.use('/caretaking', routers.caretaking);
  apiRouter.use('/maintenance', routers.maintenance);
  apiRouter.use('/rentals', routers.rental);
  apiRouter.use('/documents', routers.document);
  apiRouter.use('/finance', routers.finance);

  app.use('/api', apiRouter);
}
