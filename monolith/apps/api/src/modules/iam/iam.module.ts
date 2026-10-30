import { Router, RequestHandler } from 'express';
import { PostgresUserRepository } from './infrastructure/persistence/postgres-user.repository.js';
import { PostgresIamAuditRepository } from './infrastructure/persistence/iam-audit.repository.js';
import { PostgresMfaProtectedRouteRepository } from './infrastructure/persistence/mfa-protected-route.repository.js';
import { MfaRouteCache } from './infrastructure/cache/mfa-route.cache.js';

import { RegisterUserUseCase } from './application/commands/register-user.use-case.js';
import { LoginUserUseCase } from './application/commands/login-user.use-case.js';
import { RefreshTokenUseCase } from './application/commands/refresh-token.use-case.js';
import { GetUserByIdQuery } from './application/queries/get-user-by-id.query.js';
import { SetupMfaUseCase } from './application/commands/mfa/setup-mfa.use-case.js';
import { EnableMfaUseCase } from './application/commands/mfa/enable-mfa.use-case.js';
import { VerifyMfaUseCase } from './application/commands/mfa/verify-mfa.use-case.js';
import { ReverifyMfaUseCase } from './application/commands/mfa/reverify-mfa.use-case.js';
import { DisableMfaUseCase } from './application/commands/mfa/disable-mfa.use-case.js';
import { GetMfaStatusQuery } from './application/queries/get-mfa-status.query.js';
import { SsoLoginUseCase } from './application/commands/sso/sso-login.use-case.js';
import { GetAuditLogsQuery } from './application/queries/get-audit-logs.query.js';
import { ManageProtectedRoutesUseCase } from './application/commands/mfa/manage-protected-routes.use-case.js';

import { IamController } from './presentation/http/iam.controller.js';
import { createIamRouter } from './presentation/http/iam.routes.js';
import { createMfaReverificationMiddleware } from './presentation/middleware/mfa-reverification.middleware.js';

import { cryptoService } from '../../shared/infrastructure/crypto.service.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { UserDto } from '@monolith/contracts';

export interface IIamModulePublicApi {
  getUserById(id: string): Promise<UserDto | null>;
  verifyMfaStatus(userId: string): Promise<{ enabled: boolean; lastVerifiedAt: Date | null }>;
  getMfaRouteCache(): MfaRouteCache;
  getMfaMiddleware(): RequestHandler;
}

export class IamModule {
  public static init(): { router: Router; publicApi: IIamModulePublicApi; mfaMiddleware: RequestHandler } {
    // 1. Repositories & Caches
    const userRepository = new PostgresUserRepository();
    const auditRepository = new PostgresIamAuditRepository();
    const protectedRouteRepository = new PostgresMfaProtectedRouteRepository();
    const mfaRouteCache = new MfaRouteCache(protectedRouteRepository);

    // Warm up protected route cache asynchronously
    mfaRouteCache.warmUp();

    // 2. Application Use Cases & Queries
    const registerUserUseCase = new RegisterUserUseCase(userRepository, cryptoService, eventBus);
    const loginUserUseCase = new LoginUserUseCase(userRepository, cryptoService, auditRepository);
    const refreshTokenUseCase = new RefreshTokenUseCase(userRepository, auditRepository);
    const getUserByIdQuery = new GetUserByIdQuery(userRepository);

    const setupMfaUseCase = new SetupMfaUseCase(userRepository, auditRepository);
    const enableMfaUseCase = new EnableMfaUseCase(userRepository, auditRepository);
    const verifyMfaUseCase = new VerifyMfaUseCase(userRepository, auditRepository);
    const reverifyMfaUseCase = new ReverifyMfaUseCase(userRepository, auditRepository);
    const disableMfaUseCase = new DisableMfaUseCase(userRepository, cryptoService, auditRepository);
    const getMfaStatusQuery = new GetMfaStatusQuery(userRepository);

    const ssoLoginUseCase = new SsoLoginUseCase(userRepository, auditRepository);
    const getAuditLogsQuery = new GetAuditLogsQuery(auditRepository);
    const manageProtectedRoutesUseCase = new ManageProtectedRoutesUseCase(
      protectedRouteRepository,
      mfaRouteCache,
      auditRepository
    );

    // 3. Presentation HTTP Controller & Router
    const controller = new IamController(
      registerUserUseCase,
      loginUserUseCase,
      refreshTokenUseCase,
      getUserByIdQuery,
      setupMfaUseCase,
      enableMfaUseCase,
      verifyMfaUseCase,
      reverifyMfaUseCase,
      disableMfaUseCase,
      getMfaStatusQuery,
      ssoLoginUseCase,
      getAuditLogsQuery,
      manageProtectedRoutesUseCase
    );

    const router = createIamRouter(controller);
    const mfaMiddleware = createMfaReverificationMiddleware(mfaRouteCache, userRepository, auditRepository);

    // 4. Public API for Cross-Module Ingestion
    const publicApi: IIamModulePublicApi = {
      getUserById: async (id: string) => {
        const result = await getUserByIdQuery.execute({ id });
        return result.isSuccess ? result.getValue() : null;
      },
      verifyMfaStatus: async (userId: string) => {
        const user = await userRepository.findById(userId);
        return {
          enabled: user?.mfaEnabled ?? false,
          lastVerifiedAt: user?.mfaLastVerifiedAt ?? null
        };
      },
      getMfaRouteCache: () => mfaRouteCache,
      getMfaMiddleware: () => mfaMiddleware
    };

    container.register('IIamModulePublicApi', publicApi);

    return { router, publicApi, mfaMiddleware };
  }
}
