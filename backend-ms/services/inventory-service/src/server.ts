import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startInventoryGrpcServer } from './grpc/inventory.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4009', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50059', 10);

  await rabbitmq.connect();

  const { app, repo } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 inventory-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startInventoryGrpcServer(repo, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down inventory-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('inventory-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in inventory-service', err);
  process.exit(1);
});
