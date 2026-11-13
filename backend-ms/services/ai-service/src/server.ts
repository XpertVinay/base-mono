import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startAiGrpcServer } from './grpc/ai.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4010', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50060', 10);
  await rabbitmq.connect();

  const {
    app,
    listProviders,
    registerProvider,
    listTools,
    callTool,
    orchestrateTools,
    closeResources
  } = createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 ai-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startAiGrpcServer(
    {
      listProviders,
      registerProvider,
      listTools,
      callTool,
      orchestrateTools
    },
    grpcPort,
    app
  );

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down ai-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await closeResources();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('ai-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in ai-service', err);
  process.exit(1);
});

