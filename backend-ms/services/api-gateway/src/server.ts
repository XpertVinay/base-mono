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

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down API Gateway...`);
    server.close(() => {
      grpcManager.closeAll();
      logger.info('API Gateway shut down cleanly');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error('Fatal boot error in API Gateway', err);
  process.exit(1);
});
