import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { PostgresOrganizationRepository } from './infrastructure/persistence/postgres-organization.repository.js';
import { PostgresOrganizationMemberRepository } from './infrastructure/persistence/postgres-organization-member.repository.js';
import {
  CreateOrganizationUseCase,
  GetOrganizationQuery,
  ListOrganizationsQuery,
  UpdateOrganizationUseCase,
  UpdateOrganizationStatusUseCase,
  DeleteOrganizationUseCase,
  AddOrganizationMemberUseCase,
  ListOrganizationMembersQuery,
  UpdateOrganizationMemberRoleUseCase,
  RemoveOrganizationMemberUseCase
} from './application/use-cases/organization.use-cases.js';
import { OrganizationController } from './presentation/http/organization.controller.js';
import { createOrganizationRouter } from './presentation/http/organization.routes.js';
import { IOrganizationRepository } from './domain/repositories/organization-repository.interface.js';
import { IOrganizationMemberRepository } from './domain/repositories/organization-member-repository.interface.js';

export interface AppDependencies {
  orgRepo?: IOrganizationRepository;
  memberRepo?: IOrganizationMemberRepository;
}

export function createApp(deps: AppDependencies = {}): {
  app: Express;
  orgRepo: IOrganizationRepository;
  memberRepo: IOrganizationMemberRepository;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const orgRepo = deps.orgRepo || new PostgresOrganizationRepository();
  const memberRepo = deps.memberRepo || new PostgresOrganizationMemberRepository();

  const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
  const getQuery = new GetOrganizationQuery(orgRepo);
  const listQuery = new ListOrganizationsQuery(orgRepo);
  const updateUseCase = new UpdateOrganizationUseCase(orgRepo);
  const updateStatusUseCase = new UpdateOrganizationStatusUseCase(orgRepo);
  const deleteUseCase = new DeleteOrganizationUseCase(orgRepo, memberRepo);

  const addMemberUseCase = new AddOrganizationMemberUseCase(orgRepo, memberRepo);
  const listMembersQuery = new ListOrganizationMembersQuery(orgRepo, memberRepo);
  const updateMemberRoleUseCase = new UpdateOrganizationMemberRoleUseCase(memberRepo);
  const removeMemberUseCase = new RemoveOrganizationMemberUseCase(memberRepo);

  const controller = new OrganizationController(
    createUseCase,
    getQuery,
    listQuery,
    updateUseCase,
    updateStatusUseCase,
    deleteUseCase,
    addMemberUseCase,
    listMembersQuery,
    updateMemberRoleUseCase,
    removeMemberUseCase
  );

  const router = createOrganizationRouter(controller);

  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.json({
      status: 'UP',
      service: 'organization-service',
      version: 'v1',
      timestamp: new Date().toISOString()
    });

  app.get('/api/v1/health', healthHandler);
  app.get('/api/health', healthHandler);
  app.get('/health', healthHandler);

  app.use('/api/v1/organizations', router);
  app.use('/api/organizations', router);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, orgRepo, memberRepo };
}
