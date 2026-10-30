import { createApp } from './app.js';
import { env } from './config/env.js';
import { dbPool } from './infrastructure/database/connection-pool.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const app = createApp();

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`🚀 SOLID Modular Monolith API running at http://${env.HOST}:${env.PORT}`);
    logger.info(`📊 Health check: http://${env.HOST}:${env.PORT}/health`);
    logger.info(`📚 Swagger UI API Docs: http://${env.HOST}:${env.PORT}/api-docs`);
    logger.info(`🛡️ Environment: ${env.NODE_ENV}`);
  });

  // Graceful Shutdown Handler
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await dbPool.close();
        logger.info('Database connections closed cleanly');
        process.exit(0);
      } catch (err) {
        logger.error('Error during database teardown', err);
        process.exit(1);
      }
    });

    // Forced shutdown after 10s timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Fatal bootstrap error', err);
  process.exit(1);
});
