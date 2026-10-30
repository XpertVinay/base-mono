import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { authenticate } from '../../../../shared/presentation/auth.middleware.js';

export function createNotificationRouter(controller: NotificationController): Router {
  const router = Router();

  // Notification Configuration & Health Summary
  router.get('/config', authenticate, controller.getConfig);

  // Local Testing & Development DRY-Run Outbox Simulator APIs
  router.get('/dry-run/outbox', authenticate, controller.getDryRunOutbox);
  router.delete('/dry-run/outbox', authenticate, controller.clearDryRunOutbox);

  // High Performance Batch Notification API
  router.post('/batch', authenticate, controller.sendBatch);

  // Core Notification Sending & Querying APIs
  router.get('/', authenticate, controller.list);
  router.post('/', authenticate, controller.send);
  router.get('/:id', authenticate, controller.getById);

  // Secure Provider Webhook Ingestion
  router.post('/webhooks/:provider', controller.handleWebhook);

  return router;
}
