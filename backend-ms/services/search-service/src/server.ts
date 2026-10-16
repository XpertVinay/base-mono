import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4008', 10);
  await rabbitmq.connect();

  const { app, indexUseCase } = createApp();

  // Event-Driven RabbitMQ Projection Consumers
  await rabbitmq.subscribe(
    'search-service-indexer',
    ['orders.order_created', 'iam.user_registered'],
    async (event) => {
      logger.info(`search-service received async projection event: ${event.eventName}`, {
        eventId: event.id,
        aggregateId: event.aggregateId
      });

      if (event.eventName === 'orders.order_created') {
        const payload = event.payload as any;
        await indexUseCase.execute({
          id: payload.orderId,
          type: 'ORDER',
          title: `Order #${payload.orderId?.substring(0, 8)}`,
          description: `Order totaling ${payload.currency} ${payload.totalAmount}`,
          metadata: { userId: payload.userId, totalAmount: payload.totalAmount }
        });
      } else if (event.eventName === 'iam.user_registered') {
        const payload = event.payload as any;
        await indexUseCase.execute({
          id: payload.userId,
          type: 'USER',
          title: payload.name,
          description: `User member: ${payload.email} (${payload.role})`,
          metadata: { email: payload.email, role: payload.role }
        });
      }
    }
  );

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 search-service HTTP running at http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down search-service...`);
    server.close(async () => {
      await rabbitmq.close();
      await dbPool.close();
      logger.info('search-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in search-service', err);
  process.exit(1);
});
