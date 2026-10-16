import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4006', 10);
  await rabbitmq.connect();

  const { app, repo } = createApp();

  // RabbitMQ consumer for transaction completions
  await rabbitmq.subscribe(
    'order-service-transactions',
    ['transactions.transaction_completed'],
    async (event) => {
      const payload = event.payload as any;
      if (payload.status === 'SUCCESS' && payload.referenceId) {
        logger.info(`order-service updating order ${payload.referenceId} to PAID`);
        const order = await repo.findById(payload.referenceId);
        if (order) {
          order.markPaid();
          await repo.update(order);
          logger.info(`Order ${order.id} marked as PAID via RabbitMQ event`);
        }
      }
    }
  );

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 order-service HTTP running at http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down order-service...`);
    server.close(async () => {
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
