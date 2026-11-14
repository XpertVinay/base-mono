import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { applyIamMigrations } from './infrastructure/database/run-migrations.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startIamGrpcServer } from './grpc/iam.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4001', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50051', 10);

  if (process.env.AUTO_MIGRATE !== 'false') {
    await applyIamMigrations();
  }

  // Connect RabbitMQ
  await rabbitmq.connect();

  const { app, userRepo, tenantRepo, ssoSessionRepo } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 iam-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startIamGrpcServer(userRepo, grpcPort, tenantRepo, app, ssoSessionRepo);

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Gracefully shutting down iam-service...`);

    const forceTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded (10s). Forcing termination.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    try {
      // 1. Stop accepting new ingress HTTP connections
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info('HTTP server closed to new connections');

      // 2. Gracefully drain in-flight gRPC calls
      await new Promise<void>((resolve) => {
        grpcServer.tryShutdown((err) => {
          if (err) {
            logger.warn('gRPC tryShutdown timed out, forcing shutdown', err);
            grpcServer.forceShutdown();
          }
          resolve();
        });
      });
      logger.info('gRPC server drained and closed');

      // 3. Close RabbitMQ channels and connection
      await rabbitmq.close();

      // 4. Close Database connection pool
      await dbPool.close();

      logger.info('iam-service shut down cleanly');
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in iam-service', err);
  process.exit(1);
});
