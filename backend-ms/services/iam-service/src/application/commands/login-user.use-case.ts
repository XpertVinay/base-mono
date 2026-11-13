import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { SsoSession } from '../../domain/entities/sso-session.entity.js';
import { AuthTokensDto } from '../../shared/contracts/index.js';
import { TenantResolverService } from '../services/tenant-resolver.service.js';
import { ITokenService } from '../ports/token-service.port.js';

export interface LoginUserCommand {
  email: string;
  password: string;
  tenantId?: string;
  tenantSlug?: string;
}

export class LoginUserUseCase implements UseCase<LoginUserCommand, AuthTokensDto> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantResolver: TenantResolverService,
    private readonly tokenService: ITokenService,
    private readonly ssoSessionRepo?: ISsoSessionRepository
  ) {}

  async execute(command: LoginUserCommand): Promise<Result<AuthTokensDto>> {
    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });

    if (!tenant) {
      return Result.fail('Tenant not found or invalid tenant identifier');
    }
    if (!tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }
    if (!tenant.config.allowLocalLogin) {
      return Result.fail('Password login is disabled for this tenant; please sign in with OIDC SSO');
    }

    const user = await this.userRepo.findByEmail(command.email, tenant.id);
    if (!user) {
      return Result.fail('Invalid email or password credentials');
    }

    if (!user.isActive) {
      return Result.fail('User account has been disabled');
    }

    if (!user.passwordHash) {
      return Result.fail('This account uses federated OIDC login; please sign in with your identity provider');
    }

    const isMatch = await user.passwordHash.compare(command.password);
    if (!isMatch) {
      return Result.fail('Invalid email or password credentials');
    }

    let sessionId: string | undefined;
    let refreshTokenJti: string | undefined;
    if (this.ssoSessionRepo) {
      const session = SsoSession.create({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        authMethod: user.authMethod,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await this.ssoSessionRepo.save(session);
      sessionId = session.id;
      refreshTokenJti = session.refreshTokenJti;
    }

    const tokens = this.tokenService.issueTokens(user, {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      authMethod: user.authMethod,
      sessionId,
      refreshTokenJti,
      expiresInSeconds: tenant.config.sessionTtlSeconds
    });

    return Result.ok(tokens);
  }
}
