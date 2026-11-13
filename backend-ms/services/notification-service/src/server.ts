import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { startNotificationGrpcServer } from './grpc/notification.grpc-server.js';
import { logger } from './shared/infrastructure/logger.js';

import { NotificationEventSubscriber } from './presentation/events/notification-event.subscriber.js';
import { UserRegisteredNotificationHandler } from './presentation/events/user-registered.handler.js';
import { OrderCreatedNotificationHandler } from './presentation/events/order-created.handler.js';
import { TransactionCompletedNotificationHandler } from './presentation/events/transaction-completed.handler.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4004', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '50054', 10);
  await rabbitmq.connect();

  const { app, sendUseCase, listQuery } = createApp();

  // SOLID Event Consumers: Each event is consumed independently via its dedicated handler & queue
  const eventSubscriber = new NotificationEventSubscriber(rabbitmq, [
    new UserRegisteredNotificationHandler(sendUseCase),
    new OrderCreatedNotificationHandler(sendUseCase),
    new TransactionCompletedNotificationHandler(sendUseCase)
  ]);
  await eventSubscriber.subscribeAll();

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 notification-service HTTP running at http://0.0.0.0:${port}`);
  });

  const grpcServer = startNotificationGrpcServer(sendUseCase, listQuery, grpcPort, app);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down notification-service...`);
    server.close(async () => {
      grpcServer.forceShutdown();
      await rabbitmq.close();
      await dbPool.close();
      logger.info('notification-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in notification-service', err);
  process.exit(1);
});
