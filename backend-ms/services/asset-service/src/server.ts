import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startAssetGrpcServer } from './grpc/asset.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4002', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50052', 10);
  await rabbitmq.connect();

  const { app, createUseCase, listQuery } = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 asset-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startAssetGrpcServer(createUseCase, listQuery, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down asset-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('asset-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in asset-service', err);
  process.exit(1);
});
