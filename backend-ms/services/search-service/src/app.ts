import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresSearchRepository } from './infrastructure/persistence/postgres-search.repository.js';
import { IndexDocumentUseCase, SearchQueryUseCase } from './application/use-cases/search.use-cases.js';
import { SearchController } from './presentation/http/search.controller.js';
import { createSearchRouter } from './presentation/http/search.routes.js';

export function createApp(): { app: Express; indexUseCase: IndexDocumentUseCase } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const repo = new PostgresSearchRepository();
  const indexUseCase = new IndexDocumentUseCase(repo);
  const searchUseCase = new SearchQueryUseCase(repo);

  const controller = new SearchController(searchUseCase);
  const router = createSearchRouter(controller);

  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'search-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/search', router);
  app.use('/api/search', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, indexUseCase };
}
