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

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Gracefully shutting down asset-service...`);

    const forceTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout exceeded (10s). Forcing termination.");
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info("HTTP server closed to new connections");

      await new Promise<void>((resolve) => {
        grpcServer.tryShutdown((err) => {
          if (err) {
            logger.warn("gRPC tryShutdown timed out, forcing shutdown", err);
            grpcServer.forceShutdown();
          }
          resolve();
        });
      });
      logger.info("gRPC server drained and closed");

      await rabbitmq.close();
      await dbPool.close();

      logger.info("asset-service shut down cleanly");
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error("Error during graceful shutdown", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in asset-service', err);
  process.exit(1);
});
