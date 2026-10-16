import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { dbPool } from './shared/infrastructure/database/connection-pool.js';
import { rabbitmq } from './shared/infrastructure/messaging/rabbitmq.service.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4007', 10);
  await rabbitmq.connect();

  const app = createApp();
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🚀 transaction-service HTTP running at http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down transaction-service...`);
    server.close(async () => {
      await rabbitmq.close();
      await dbPool.close();
      logger.info('transaction-service shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in transaction-service', err);
  process.exit(1);
});
