import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { logger } from './shared/infrastructure/logger.js';

async function bootstrap() {
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  const { app, grpcManager } = createApp();

  const server = app.listen(port, host, () => {
    logger.info(`🌐 API Gateway running at http://${host}:${port} (gRPC Upstream Dispatch Enabled)`);
    logger.info(`📚 Swagger UI API Docs: http://${host}:${port}/api-docs`);
    logger.info(`💓 Gateway Health check: http://${host}:${port}/api/v1/health`);
    logger.info(`📊 Aggregated gRPC Health check: http://${host}:${port}/api/v1/health/detailed`);
    logger.info('🔌 Mapped gRPC Upstreams:', grpcManager.getServiceMap());
  });

  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Gracefully shutting down API Gateway...`);

    const forceTimer = setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded (10s). Forcing termination.');
      process.exit(1);
    }, 10000);
    forceTimer.unref();

    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      logger.info('HTTP server closed to new connections');

      grpcManager.closeAll();
      logger.info('gRPC client channels closed');

      logger.info('API Gateway shut down cleanly');
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      logger.error('Error during graceful shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in API Gateway', err);
  process.exit(1);
});
