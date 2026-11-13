import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startOrganizationGrpcServer } from './grpc/organization.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4012', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50062', 10);

  await rabbitmq.connect();

  const { app, orgRepo, memberRepo } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 organization-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startOrganizationGrpcServer(orgRepo, memberRepo, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down organization-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('organization-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal boot error in organization-service', err);
  process.exit(1);
});
