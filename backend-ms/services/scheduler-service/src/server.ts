import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startSchedulerGrpcServer } from './grpc/scheduler.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4005', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50055', 10);
  await rabbitmq.connect();

  const { app, listQuery, createUseCase, triggerUseCase } = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 scheduler-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startSchedulerGrpcServer(listQuery, createUseCase, triggerUseCase, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down scheduler-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('scheduler-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in scheduler-service', err);
  process.exit(1);
});
