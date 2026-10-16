import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository.js';
import { RegisterUserUseCase } from './application/commands/register-user.use-case.js';
import { LoginUserUseCase } from './application/commands/login-user.use-case.js';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query.js';
import { IamController } from './presentation/http/iam.controller.js';
import { createIamRouter } from './presentation/http/iam.routes.js';

export function createApp(): { app: Express; userRepo: PostgresUserRepository } {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(rateLimiter());

  const userRepo = new PostgresUserRepository();
  const registerUseCase = new RegisterUserUseCase(userRepo);
  const loginUseCase = new LoginUserUseCase(userRepo);
  const getUserByIdQuery = new GetUserByIdQuery(userRepo);

  const controller = new IamController(registerUseCase, loginUseCase, getUserByIdQuery);
  const router = createIamRouter(controller);

  // Health probe
  app.get('/health', (_req, res) => res.json({ status: 'UP', service: 'iam-service', timestamp: new Date().toISOString() }));

  app.use('/api/v1/iam', router);
  // Alias for backward compatibility
  app.use('/api/iam', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, userRepo };
}
