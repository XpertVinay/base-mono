import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startRbacGrpcServer } from './grpc/rbac.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4013', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50063', 10);

  await rabbitmq.connect();

  const { app, repos } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 rbac-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startRbacGrpcServer(repos, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down rbac-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('rbac-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in rbac-service', err);
  process.exit(1);
});
