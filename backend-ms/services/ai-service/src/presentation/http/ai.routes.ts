import { Router } from 'express';
import { AiController } from './ai.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createAiRouter(controller: AiController): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.status(200).json({
      service: 'ai-service',
      description: 'AI & MCP Extensible Provider and Orchestration Service',
      version: '1.0.0',
      endpoints: [
        '/capabilities',
        '/providers',
        '/tools',
        '/tools/call',
        '/orchestrate',
        '/invocations',
        '/health'
      ]
    });
  });

  router.get('/capabilities', controller.capabilities);

  // Provider Management (Extensible MCP, Communication, Search, DB, External API providers)
  router.get('/providers', requireAuth, controller.listAllProviders);
  router.post('/providers', requireAuth, requireRole(['ADMIN']), controller.register);
  router.get('/providers/:idOrSlug', requireAuth, controller.getOneProvider);
  router.put('/providers/:idOrSlug', requireAuth, requireRole(['ADMIN']), controller.update);
  router.delete('/providers/:idOrSlug', requireAuth, requireRole(['ADMIN']), controller.remove);
  router.post('/providers/:idOrSlug/sync', requireAuth, requireRole(['ADMIN']), controller.syncTools);
  router.post('/providers/:idOrSlug/health', requireAuth, controller.healthCheckProvider);

  // MCP Resources & Prompts
  router.get('/providers/:idOrSlug/resources', requireAuth, controller.listProviderResources);
  router.post('/providers/:idOrSlug/resources/read', requireAuth, controller.readProviderResource);
  router.get('/providers/:idOrSlug/prompts', requireAuth, controller.listProviderPrompts);
  router.post('/providers/:idOrSlug/prompts/:promptName/get', requireAuth, controller.getProviderPrompt);

  // MCP Tool Discovery, Invocation & Orchestration
  router.get('/tools', requireAuth, controller.listAllTools);
  router.post('/tools/call', requireAuth, controller.invokeTool);
  router.post('/providers/:idOrSlug/tools/:toolName/call', requireAuth, controller.invokeProviderTool);
  router.post('/orchestrate', requireAuth, controller.orchestrate);

  // Telemetry / Invocation Logs
  router.get('/invocations', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.invocations);

  return router;
}

