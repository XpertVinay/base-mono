import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';

import { PostgresRoleRepository } from './infrastructure/persistence/postgres-role.repository.js';
import { PostgresPermissionRepository } from './infrastructure/persistence/postgres-permission.repository.js';
import { PostgresUserRoleRepository } from './infrastructure/persistence/postgres-user-role.repository.js';
import { IRoleRepository } from './domain/repositories/role-repository.interface.js';
import { IPermissionRepository } from './domain/repositories/permission-repository.interface.js';
import { IUserRoleRepository } from './domain/repositories/user-role-repository.interface.js';

import {
  CreateRoleUseCase,
  GetRoleByIdQuery,
  ListRolesQuery,
  UpdateRoleUseCase,
  DeleteRoleUseCase
} from './application/use-cases/role.use-cases.js';
import {
  ListPermissionsQuery,
  ListPermissionCategoriesQuery,
  GetPermissionByIdQuery,
  CreatePermissionUseCase,
  UpdatePermissionUseCase,
  DeletePermissionUseCase
} from './application/use-cases/permission.use-cases.js';
import {
  AssignRoleToUserUseCase,
  RevokeRoleFromUserUseCase,
  GetUserRolesQuery,
  ListRoleUsersQuery,
  CheckUserPermissionQuery
} from './application/use-cases/assignment.use-cases.js';

import { RoleController } from './presentation/http/role.controller.js';
import { createRoleRouter } from './presentation/http/role.routes.js';
import { PermissionController } from './presentation/http/permission.controller.js';
import { createPermissionRouter } from './presentation/http/permission.routes.js';
import { AssignmentController } from './presentation/http/assignment.controller.js';
import { createAssignmentRouter } from './presentation/http/assignment.routes.js';

export interface AppDependencies {
  roleRepo?: IRoleRepository;
  permRepo?: IPermissionRepository;
  userRoleRepo?: IUserRoleRepository;
}

export interface AppInstance {
  app: Express;
  repos: {
    roleRepo: IRoleRepository;
    permRepo: IPermissionRepository;
    userRoleRepo: IUserRoleRepository;
  };
}

export function createApp(deps: AppDependencies = {}): AppInstance {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  // Repositories
  const roleRepo = deps.roleRepo || new PostgresRoleRepository();
  const permRepo = deps.permRepo || new PostgresPermissionRepository();
  const userRoleRepo = deps.userRoleRepo || new PostgresUserRoleRepository();

  // Role Use Cases
  const createRoleUseCase = new CreateRoleUseCase(roleRepo, permRepo);
  const getRoleByIdQuery = new GetRoleByIdQuery(roleRepo);
  const listRolesQuery = new ListRolesQuery(roleRepo);
  const updateRoleUseCase = new UpdateRoleUseCase(roleRepo, permRepo);
  const deleteRoleUseCase = new DeleteRoleUseCase(roleRepo, userRoleRepo);

  // Permission Use Cases
  const listPermissionsQuery = new ListPermissionsQuery(permRepo);
  const listPermissionCategoriesQuery = new ListPermissionCategoriesQuery(permRepo);
  const getPermissionByIdQuery = new GetPermissionByIdQuery(permRepo);
  const createPermissionUseCase = new CreatePermissionUseCase(permRepo);
  const updatePermissionUseCase = new UpdatePermissionUseCase(permRepo);
  const deletePermissionUseCase = new DeletePermissionUseCase(permRepo);

  // Assignment Use Cases
  const assignRoleUseCase = new AssignRoleToUserUseCase(userRoleRepo, roleRepo);
  const revokeRoleUseCase = new RevokeRoleFromUserUseCase(userRoleRepo);
  const getUserRolesQuery = new GetUserRolesQuery(userRoleRepo);
  const listRoleUsersQuery = new ListRoleUsersQuery(userRoleRepo, roleRepo);
  const checkUserPermissionQuery = new CheckUserPermissionQuery(userRoleRepo);

  // Controllers
  const roleController = new RoleController(
    createRoleUseCase,
    getRoleByIdQuery,
    listRolesQuery,
    updateRoleUseCase,
    deleteRoleUseCase
  );
  const permissionController = new PermissionController(
    listPermissionsQuery,
    listPermissionCategoriesQuery,
    getPermissionByIdQuery,
    createPermissionUseCase,
    updatePermissionUseCase,
    deletePermissionUseCase
  );
  const assignmentController = new AssignmentController(
    assignRoleUseCase,
    revokeRoleUseCase,
    getUserRolesQuery,
    listRoleUsersQuery,
    checkUserPermissionQuery
  );

  // Routers
  const roleRouter = createRoleRouter(roleController);
  const permissionRouter = createPermissionRouter(permissionController);
  const assignmentRouter = createAssignmentRouter(assignmentController);

  // Health probes (versioned + unversioned + container probe)
  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({
      status: 'ok',
      service: 'rbac-service',
      version: 'v1',
      timestamp: new Date().toISOString()
    });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/rbac/health',
      '/api/rbac/health',
      '/api/v1/health',
      '/api/health'
    ],
    healthHandler
  );

  // Mount API Routes
  // Canonical Back-Office Routes (Feature F12)
  app.use('/api/v1/backoffice/rbac/roles', roleRouter);
  app.use('/api/backoffice/rbac/roles', roleRouter);
  app.use('/api/v1/backoffice/rbac/permissions', permissionRouter);
  app.use('/api/backoffice/rbac/permissions', permissionRouter);
  app.use('/api/v1/backoffice/rbac', assignmentRouter);
  app.use('/api/backoffice/rbac', assignmentRouter);

  app.use('/api/v1/rbac/roles', roleRouter);
  app.use('/api/rbac/roles', roleRouter);

  app.use('/api/v1/rbac/permissions', permissionRouter);
  app.use('/api/rbac/permissions', permissionRouter);

  app.use('/api/v1/rbac', assignmentRouter);
  app.use('/api/rbac', assignmentRouter);

  // Fallthrough 404 & Error Handler
  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return {
    app,
    repos: {
      roleRepo,
      permRepo,
      userRoleRepo
    }
  };
}
