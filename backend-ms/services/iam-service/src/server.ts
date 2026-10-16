import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startIamGrpcServer } from './grpc/iam.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4001', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50051', 10);

  // Connect RabbitMQ
  await rabbitmq.connect();

  const { app, userRepo } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 iam-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startIamGrpcServer(userRepo, grpcPort);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down iam-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('iam-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in iam-service', err);
  process.exit(1);
});
