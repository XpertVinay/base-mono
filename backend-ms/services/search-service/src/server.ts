import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { logger } from './shared/infrastructure/logger.js';

import { SearchEventSubscriber } from './presentation/events/search-event.subscriber.js';
import { OrderCreatedSearchProjectionHandler } from './presentation/events/order-created-projection.handler.js';
import { UserRegisteredSearchProjectionHandler } from './presentation/events/user-registered-projection.handler.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4008', 10);
  await rabbitmq.connect();

  const { app, indexUseCase } = createApp();

  // SOLID Event Consumers: Each projection event is consumed independently via its dedicated handler & queue
  const eventSubscriber = new SearchEventSubscriber(rabbitmq, [
    new OrderCreatedSearchProjectionHandler(indexUseCase),
    new UserRegisteredSearchProjectionHandler(indexUseCase)
  ]);
  await eventSubscriber.subscribeAll();

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
