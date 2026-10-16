import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { monitoringManager } from './infrastructure/monitoring/monitoring.manager.js';
import { startAuditGrpcServer } from './grpc/audit.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4011', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50061', 10);

  // 1. Initialize Flag-based Monitoring Adapters (CloudWatch, Prometheus, Grafana)
  await monitoringManager.init();

  // 2. Connect RabbitMQ
  await rabbitmq.connect();

  const { app, recordUseCase, queryUseCase } = createApp();

  // 3. Subscribe to all relevant domain integration events for comprehensive audit trail
  await rabbitmq.subscribe(
    'audit-service-event-recorder',
    [
      'iam.*',
      'orders.*',
      'transactions.*',
      'assets.*',
      'config.*',
      'audit.*'
    ],
    async (event) => {
      logger.info(`audit-service recording immutable audit trail for event: ${event.eventName}`, {
        eventId: event.id,
        aggregateId: event.aggregateId
      });

      const payload = event.payload as any;
      await recordUseCase.execute({
        actorId: payload.userId || payload.actorId || undefined,
        actorEmail: payload.email || undefined,
        action: event.eventName,
        resource: event.eventName.split('.')[0] || 'SYSTEM',
        resourceId: event.aggregateId,
        severity: event.eventName.includes('failed') ? 'WARN' : 'INFO',
        details: payload,
        correlationId: event.id
      });
    }
  );

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 audit-service HTTP running at http://0.0.0.0:${port}`);
    logger.info(`📊 Prometheus metrics available at http://0.0.0.0:${port}/metrics`);
  });

  const grpcServer = startAuditGrpcServer(recordUseCase, queryUseCase, grpcPort);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down audit-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('audit-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in audit-service', err);
  process.exit(1);
});
