import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4004', 10);
  await rabbitmq.connect();

  const { app, sendUseCase } = createApp();

  // Setup RabbitMQ Event-Driven Consumers
  await rabbitmq.subscribe(
    'notification-service-events',
    ['iam.user_registered', 'orders.order_created', 'transactions.transaction_completed'],
    async (event) => {
      logger.info(`notification-service received async event: ${event.eventName}`, {
        eventId: event.id,
        aggregateId: event.aggregateId
      });

      if (event.eventName === 'iam.user_registered') {
        const payload = event.payload as any;
        await sendUseCase.execute({
          recipient: payload.email,
          channel: 'EMAIL',
          subject: `Welcome to the Microservices Platform, ${payload.name}!`,
          body: 'Your account has been created successfully. Welcome aboard!'
        });
      } else if (event.eventName === 'orders.order_created') {
        const payload = event.payload as any;
        await sendUseCase.execute({
          recipient: `user-${payload.userId}@platform.local`,
          channel: 'EMAIL',
          subject: `Order #${payload.orderId?.substring(0, 8)} Created`,
          body: `Your order totaling ${payload.currency} ${payload.totalAmount} has been registered.`
        });
      } else if (event.eventName === 'transactions.transaction_completed') {
        const payload = event.payload as any;
        if (payload.status === 'SUCCESS') {
          await sendUseCase.execute({
            recipient: `user-${payload.userId || 'customer'}@platform.local`,
            channel: 'EMAIL',
            subject: `Payment Succeeded for ${payload.referenceId}`,
            body: `Your transaction of ${payload.currency} ${payload.amount} was completed successfully.`
          });
        }
      }
    }
  );

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 notification-service HTTP running at http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down notification-service...`);
    server.close(async () => {
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
