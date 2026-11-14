import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { correlationIdMiddleware } from './shared/presentation/request-context.js';
import { tenantContextMiddleware } from './shared/presentation/tenant.middleware.js';
import { rateLimiter } from './shared/presentation/rate-limiter.middleware.js';
import { errorHandlerMiddleware, NotFoundError } from './shared/presentation/error-handler.middleware.js';
import { requireAuth, requireRole } from './shared/presentation/auth.middleware.js';
import { IUserRepository } from './domain/repositories/user-repository.interface.js';
import { ITenantRepository } from './domain/repositories/tenant-repository.interface.js';
import { IOidcProviderRepository } from './domain/repositories/oidc-provider-repository.interface.js';
import { IFederatedIdentityRepository } from './domain/repositories/federated-identity-repository.interface.js';
import { IOidcAuthStateRepository } from './domain/repositories/oidc-auth-state-repository.interface.js';
import { ISsoSessionRepository } from './domain/repositories/sso-session-repository.interface.js';
import { ISsoHandoffRepository } from './domain/repositories/sso-handoff-repository.interface.js';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository.js';
import { PostgresTenantRepository } from './infrastructure/persistence/postgres-tenant.repository.js';
import { PostgresOidcProviderRepository } from './infrastructure/persistence/postgres-oidc-provider.repository.js';
import { PostgresFederatedIdentityRepository } from './infrastructure/persistence/postgres-federated-identity.repository.js';
import { PostgresOidcAuthStateRepository } from './infrastructure/persistence/postgres-oidc-auth-state.repository.js';
import { PostgresSsoSessionRepository } from './infrastructure/persistence/postgres-sso-session.repository.js';
import { PostgresSsoHandoffRepository } from './infrastructure/persistence/postgres-sso-handoff.repository.js';
import {
  InMemorySsoHandoffRepository,
  InMemorySsoSessionRepository
} from './infrastructure/persistence/in-memory-sso.repositories.js';
import { JwtTokenService } from './infrastructure/security/jwt-token.service.js';
import { OidcProviderRegistry } from './infrastructure/oidc/oidc-provider-registry.js';
import { TenantResolverService } from './application/services/tenant-resolver.service.js';
import { RegisterUserUseCase } from './application/commands/register-user.use-case.js';
import { LoginUserUseCase } from './application/commands/login-user.use-case.js';
import { RefreshTokenUseCase } from './application/commands/refresh-token.use-case.js';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query.js';
import {
  CreateTenantUseCase,
  GetTenantQuery,
  ListTenantsQuery,
  OnboardTenantUseCase,
  UpdateTenantUseCase
} from './application/commands/tenant.use-cases.js';
import {
  ApproveOidcProviderUseCase,
  AssociateSystemProviderUseCase,
  ConfigureOidcProviderUseCase,
  DeleteOidcProviderUseCase,
  ListOidcProvidersAdminQuery,
  ListPendingOidcProvidersQuery,
  ListTenantOidcProvidersQuery,
  RejectOidcProviderUseCase,
  TestOidcProviderDiscoveryUseCase,
  UpdateOidcProviderUseCase
} from './application/commands/oidc-provider.use-cases.js';
import {
  ExchangeOidcIdTokenUseCase,
  HandleOidcCallbackUseCase,
  InitiateOidcLoginUseCase,
  ListMyFederatedIdentitiesQuery,
  UnlinkFederatedIdentityUseCase
} from './application/commands/federated-auth.use-cases.js';
import {
  CreateSsoHandoffCodeUseCase,
  ExchangeServiceTokenUseCase,
  HandleBackchannelLogoutUseCase,
  InitiateSloLogoutUseCase,
  IntrospectSsoTokenUseCase,
  ListMySsoSessionsQuery,
  RedeemSsoHandoffCodeUseCase
} from './application/commands/sso.use-cases.js';
import {
  ListBackOfficeUsersQuery,
  GetBackOfficeUserDetailQuery,
  CreateBackOfficeUserUseCase,
  UpdateBackOfficeUserUseCase,
  UpdateBackOfficeUserStatusUseCase,
  ResetBackOfficeUserPasswordUseCase,
  DeleteBackOfficeUserUseCase,
  ListUserSessionsQuery,
  RevokeUserSessionsUseCase,
  GetBackOfficeRolesQuery,
  DeleteTenantUseCase
} from './application/commands/backoffice-user.use-cases.js';
import { IamController } from './presentation/http/iam.controller.js';
import { createIamRouter } from './presentation/http/iam.routes.js';
import { TenantController } from './presentation/http/tenant.controller.js';
import { createTenantRouter } from './presentation/http/tenant.routes.js';
import { BackOfficeController } from './presentation/http/backoffice.controller.js';
import { createBackOfficeRouter } from './presentation/http/backoffice.routes.js';
import { OidcController } from './presentation/http/oidc.controller.js';
import { createFederatedIdentityRouter, createOidcRouter } from './presentation/http/oidc.routes.js';
import { SsoController } from './presentation/http/sso.controller.js';
import { createSsoRouter } from './presentation/http/sso.routes.js';
import { IOidcProviderRegistry } from './application/ports/oidc-provider-adapter.port.js';
import { ITokenService } from './application/ports/token-service.port.js';

export interface IamAppDependencies {
  userRepo?: IUserRepository;
  tenantRepo?: ITenantRepository;
  oidcProviderRepo?: IOidcProviderRepository;
  federatedIdentityRepo?: IFederatedIdentityRepository;
  oidcAuthStateRepo?: IOidcAuthStateRepository;
  ssoSessionRepo?: ISsoSessionRepository;
  ssoHandoffRepo?: ISsoHandoffRepository;
  oidcRegistry?: IOidcProviderRegistry;
  tokenService?: ITokenService;
}

export function createApp(deps: IamAppDependencies = {}): {
  app: Express;
  userRepo: IUserRepository;
  tenantRepo: ITenantRepository;
  oidcRegistry: IOidcProviderRegistry;
  ssoSessionRepo: ISsoSessionRepository;
} {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(correlationIdMiddleware);
  app.use(tenantContextMiddleware());
  app.use(rateLimiter());

  const isInMemoryMode = Boolean(deps.userRepo);
  const userRepo = deps.userRepo || new PostgresUserRepository();
  const tenantRepo = deps.tenantRepo || new PostgresTenantRepository();
  const oidcProviderRepo = deps.oidcProviderRepo || new PostgresOidcProviderRepository();
  const federatedIdentityRepo = deps.federatedIdentityRepo || new PostgresFederatedIdentityRepository();
  const oidcAuthStateRepo = deps.oidcAuthStateRepo || new PostgresOidcAuthStateRepository();
  const ssoSessionRepo =
    deps.ssoSessionRepo ||
    (isInMemoryMode ? new InMemorySsoSessionRepository() : new PostgresSsoSessionRepository());
  const ssoHandoffRepo =
    deps.ssoHandoffRepo ||
    (isInMemoryMode ? new InMemorySsoHandoffRepository() : new PostgresSsoHandoffRepository());
  const oidcRegistry = deps.oidcRegistry || new OidcProviderRegistry();
  const tokenService = deps.tokenService || new JwtTokenService();

  app.locals.ssoSessionRepo = ssoSessionRepo;

  const tenantResolver = new TenantResolverService(tenantRepo);

  // Core IAM use cases
  const registerUseCase = new RegisterUserUseCase(userRepo, tenantResolver);
  const loginUseCase = new LoginUserUseCase(userRepo, tenantResolver, tokenService, ssoSessionRepo);
  const refreshTokenUseCase = new RefreshTokenUseCase(userRepo, tenantRepo, tokenService, ssoSessionRepo);
  const getUserByIdQuery = new GetUserByIdQuery(userRepo);

  // Tenant management use cases
  const createTenantUseCase = new CreateTenantUseCase(tenantRepo);
  const onboardTenantUseCase = new OnboardTenantUseCase(tenantRepo, userRepo, oidcProviderRepo);
  const updateTenantUseCase = new UpdateTenantUseCase(tenantRepo);
  const getTenantQuery = new GetTenantQuery(tenantRepo);
  const listTenantsQuery = new ListTenantsQuery(tenantRepo);

  // OIDC / OAuth2 / SAML Provider Config & Approval use cases
  const configureProviderUseCase = new ConfigureOidcProviderUseCase(oidcProviderRepo, tenantResolver);
  const associateProviderUseCase = new AssociateSystemProviderUseCase(oidcProviderRepo, tenantResolver);
  const approveProviderUseCase = new ApproveOidcProviderUseCase(oidcProviderRepo, tenantResolver);
  const rejectProviderUseCase = new RejectOidcProviderUseCase(oidcProviderRepo, tenantResolver);
  const updateProviderUseCase = new UpdateOidcProviderUseCase(oidcProviderRepo, tenantResolver);
  const deleteProviderUseCase = new DeleteOidcProviderUseCase(oidcProviderRepo, tenantResolver);
  const listProvidersAdminQuery = new ListOidcProvidersAdminQuery(oidcProviderRepo, tenantResolver);
  const listPendingProvidersQuery = new ListPendingOidcProvidersQuery(oidcProviderRepo);
  const listTenantProvidersQuery = new ListTenantOidcProvidersQuery(oidcProviderRepo, tenantResolver);
  const testDiscoveryUseCase = new TestOidcProviderDiscoveryUseCase(oidcProviderRepo, tenantResolver, oidcRegistry);

  // Federated Auth & Internal SSO / SLO use cases
  const initiateLoginUseCase = new InitiateOidcLoginUseCase(
    tenantResolver,
    oidcProviderRepo,
    oidcAuthStateRepo,
    oidcRegistry
  );
  const handleCallbackUseCase = new HandleOidcCallbackUseCase(
    tenantRepo,
    oidcProviderRepo,
    userRepo,
    federatedIdentityRepo,
    oidcAuthStateRepo,
    oidcRegistry,
    tokenService,
    ssoSessionRepo
  );
  const exchangeIdTokenUseCase = new ExchangeOidcIdTokenUseCase(
    tenantResolver,
    oidcProviderRepo,
    userRepo,
    federatedIdentityRepo,
    oidcRegistry,
    tokenService,
    ssoSessionRepo
  );
  const listFederatedQuery = new ListMyFederatedIdentitiesQuery(federatedIdentityRepo);
  const unlinkFederatedUseCase = new UnlinkFederatedIdentityUseCase(userRepo, federatedIdentityRepo);

  const createSsoHandoffUseCase = new CreateSsoHandoffCodeUseCase(ssoSessionRepo, ssoHandoffRepo);
  const redeemSsoHandoffUseCase = new RedeemSsoHandoffCodeUseCase(
    ssoHandoffRepo,
    ssoSessionRepo,
    userRepo,
    tenantRepo,
    tokenService
  );
  const exchangeServiceTokenUseCase = new ExchangeServiceTokenUseCase(
    ssoSessionRepo,
    userRepo,
    tenantRepo,
    tokenService
  );
  const introspectSsoTokenUseCase = new IntrospectSsoTokenUseCase(ssoSessionRepo);
  const listMySsoSessionsQuery = new ListMySsoSessionsQuery(ssoSessionRepo);
  const initiateSloLogoutUseCase = new InitiateSloLogoutUseCase(ssoSessionRepo, oidcProviderRepo, oidcRegistry);
  const backchannelLogoutUseCase = new HandleBackchannelLogoutUseCase(oidcProviderRepo, ssoSessionRepo, oidcRegistry);

  const iamController = new IamController(registerUseCase, loginUseCase, getUserByIdQuery, refreshTokenUseCase, tokenService);
  const deleteTenantUseCase = new DeleteTenantUseCase(tenantRepo);
  const tenantController = new TenantController(
    createTenantUseCase,
    updateTenantUseCase,
    getTenantQuery,
    listTenantsQuery,
    onboardTenantUseCase,
    deleteTenantUseCase
  );

  // Back-Office Portal use cases
  const listBackOfficeUsersQuery = new ListBackOfficeUsersQuery(userRepo, tenantResolver);
  const getBackOfficeUserDetailQuery = new GetBackOfficeUserDetailQuery(
    userRepo,
    tenantRepo,
    federatedIdentityRepo,
    ssoSessionRepo
  );
  const createBackOfficeUserUseCase = new CreateBackOfficeUserUseCase(userRepo, tenantResolver);
  const updateBackOfficeUserUseCase = new UpdateBackOfficeUserUseCase(userRepo, ssoSessionRepo);
  const updateBackOfficeUserStatusUseCase = new UpdateBackOfficeUserStatusUseCase(userRepo, ssoSessionRepo);
  const resetBackOfficeUserPasswordUseCase = new ResetBackOfficeUserPasswordUseCase(userRepo, ssoSessionRepo);
  const deleteBackOfficeUserUseCase = new DeleteBackOfficeUserUseCase(userRepo, ssoSessionRepo);
  const listUserSessionsQuery = new ListUserSessionsQuery(userRepo, ssoSessionRepo);
  const revokeUserSessionsUseCase = new RevokeUserSessionsUseCase(ssoSessionRepo);
  const getBackOfficeRolesQuery = new GetBackOfficeRolesQuery();

  const backOfficeController = new BackOfficeController(
    listBackOfficeUsersQuery,
    getBackOfficeUserDetailQuery,
    createBackOfficeUserUseCase,
    updateBackOfficeUserUseCase,
    updateBackOfficeUserStatusUseCase,
    resetBackOfficeUserPasswordUseCase,
    deleteBackOfficeUserUseCase,
    listUserSessionsQuery,
    revokeUserSessionsUseCase,
    getBackOfficeRolesQuery,
    deleteTenantUseCase
  );

  const oidcController = new OidcController(
    configureProviderUseCase,
    updateProviderUseCase,
    deleteProviderUseCase,
    listProvidersAdminQuery,
    listTenantProvidersQuery,
    testDiscoveryUseCase,
    initiateLoginUseCase,
    handleCallbackUseCase,
    exchangeIdTokenUseCase,
    listFederatedQuery,
    unlinkFederatedUseCase,
    oidcRegistry,
    associateProviderUseCase,
    approveProviderUseCase,
    rejectProviderUseCase,
    listPendingProvidersQuery,
    initiateSloLogoutUseCase,
    backchannelLogoutUseCase,
    createSsoHandoffUseCase
  );
  const ssoController = new SsoController(
    createSsoHandoffUseCase,
    redeemSsoHandoffUseCase,
    exchangeServiceTokenUseCase,
    introspectSsoTokenUseCase,
    listMySsoSessionsQuery,
    initiateSloLogoutUseCase
  );

  const iamRouter = createIamRouter(iamController);
  const tenantRouter = createTenantRouter(tenantController);
  const oidcRouter = createOidcRouter(oidcController);
  const federatedRouter = createFederatedIdentityRouter(oidcController);
  const ssoRouter = createSsoRouter(ssoController);
  const backOfficeRouter = createBackOfficeRouter(backOfficeController);

  // Health probe
  const healthHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json({
      status: 'ok',
      service: 'iam-service',
      multiTenancyEnabled: process.env.MULTI_TENANCY_ENABLED !== 'false',
      multiTenancyMode: process.env.MULTI_TENANCY_MODE || 'optional',
      supportedOidcProviders: oidcRegistry.listSupportedTypes(),
      timestamp: new Date().toISOString()
    });

  app.get(
    [
      '/health',
      '/ready',
      '/live',
      '/api/v1/iam/health',
      '/api/iam/health',
      '/api/v1/health',
      '/api/health'
    ],
    healthHandler
  );

  // JWKS Public Key Endpoint (Feature F19)
  const jwksHandler = (_req: express.Request, res: express.Response) =>
    res.status(200).json(tokenService.getJwks ? tokenService.getJwks() : { keys: [] });

  app.get(
    [
      '/.well-known/jwks.json',
      '/jwks',
      '/api/v1/iam/.well-known/jwks.json',
      '/api/iam/.well-known/jwks.json',
      '/api/v1/iam/jwks',
      '/api/iam/jwks'
    ],
    jwksHandler
  );

  // Canonical Back-Office Routes (Feature F12)
  const backofficeUsersRouter = express.Router();
  backofficeUsersRouter.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), backOfficeController.listUsers);
  backofficeUsersRouter.post('/', requireAuth, requireRole(['ADMIN']), backOfficeController.createUser);
  backofficeUsersRouter.get('/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), backOfficeController.getUser);
  backofficeUsersRouter.put('/:id', requireAuth, requireRole(['ADMIN']), backOfficeController.updateUser);
  backofficeUsersRouter.patch('/:id', requireAuth, requireRole(['ADMIN']), backOfficeController.updateUser);
  backofficeUsersRouter.patch('/:id/status', requireAuth, requireRole(['ADMIN', 'SUPPORT']), backOfficeController.updateUserStatus);
  backofficeUsersRouter.post('/:id/reset-password', requireAuth, requireRole(['ADMIN']), backOfficeController.resetPassword);
  backofficeUsersRouter.delete('/:id', requireAuth, requireRole(['ADMIN']), backOfficeController.deleteUser);
  backofficeUsersRouter.get('/:id/sessions', requireAuth, requireRole(['ADMIN', 'SUPPORT']), backOfficeController.listUserSessions);
  backofficeUsersRouter.delete('/:id/sessions', requireAuth, requireRole(['ADMIN']), backOfficeController.revokeUserSessions);

  const backofficeRolesRouter = express.Router();
  backofficeRolesRouter.get('/', requireAuth, requireRole(['ADMIN', 'SUPPORT']), backOfficeController.getRoles);

  app.use('/api/v1/backoffice/users', backofficeUsersRouter);
  app.use('/api/backoffice/users', backofficeUsersRouter);
  app.use('/api/v1/backoffice/roles', backofficeRolesRouter);
  app.use('/api/backoffice/roles', backofficeRolesRouter);

  app.use('/api/v1/backoffice/iam', backOfficeRouter);
  app.use('/api/backoffice/iam', backOfficeRouter);
  app.use('/api/v1/backoffice', backOfficeRouter);
  app.use('/api/backoffice', backOfficeRouter);

  app.use('/api/v1/iam/backoffice', backOfficeRouter);
  app.use('/api/iam/backoffice', backOfficeRouter);
  app.use('/api/v1/iam/admin', backOfficeRouter);
  app.use('/api/iam/admin', backOfficeRouter);

  app.use('/api/v1/iam/tenants', tenantRouter);
  app.use('/api/iam/tenants', tenantRouter);

  app.use('/api/v1/iam/oidc', oidcRouter);
  app.use('/api/iam/oidc', oidcRouter);

  app.use('/api/v1/iam/sso', ssoRouter);
  app.use('/api/iam/sso', ssoRouter);

  app.use('/api/v1/iam/federated-identities', federatedRouter);
  app.use('/api/iam/federated-identities', federatedRouter);

  app.use('/api/v1/iam', iamRouter);
  app.use('/api/iam', iamRouter);

  app.use((req, _res, next) => next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`)));
  app.use(errorHandlerMiddleware);

  return { app, userRepo, tenantRepo, oidcRegistry, ssoSessionRepo };
}
