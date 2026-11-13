import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startOrderGrpcServer } from './grpc/order.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

import { TransactionCompletedOrderHandler } from './presentation/events/transaction-completed.handler.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4006', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50056', 10);
  await rabbitmq.connect();

  const { app, repo, createUseCase, cancelUseCase, getByIdQuery, listMyQuery } = createApp();

  // SOLID Event Consumer: Dedicated transaction completion handler
  const transactionHandler = new TransactionCompletedOrderHandler(repo);
  await rabbitmq.subscribe(
    transactionHandler.queueName,
    [transactionHandler.eventName],
    async (event) => {
      await transactionHandler.handle(event as any);
    }
  );

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 order-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startOrderGrpcServer(
    { createUseCase, cancelUseCase, getByIdQuery, listMyQuery },
    grpcPort,
    app
  );

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down order-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('order-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in order-service', err);
  process.exit(1);
});
