import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { monitoringManager } from './infrastructure/monitoring/monitoring.manager.js';
import { startAuditGrpcServer } from './grpc/audit.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

import { AuditEventRecorder } from './presentation/events/audit-event-recorder.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4011', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50061', 10);

  // 1. Initialize Flag-based Monitoring Adapters (CloudWatch, Prometheus, Grafana)
  await monitoringManager.init();

  // 2. Connect RabbitMQ
  await rabbitmq.connect();

  const { app, recordUseCase, queryUseCase } = createApp();

  // 3. Start Audit Event Recorder (SOLID decoupled event subscriber)
  const auditRecorder = new AuditEventRecorder(rabbitmq, recordUseCase);
  await auditRecorder.start();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 audit-service HTTP running at http://0.0.0.0:${port}`);
    logger.info(`📊 Prometheus metrics available at http://0.0.0.0:${port}/metrics`);
  });

  const grpcServer = startAuditGrpcServer(recordUseCase, queryUseCase, grpcPort, app);

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
