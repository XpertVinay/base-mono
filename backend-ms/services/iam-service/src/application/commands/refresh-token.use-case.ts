import crypto from 'crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { AuthTokensDto } from '../../shared/contracts/index.js';
import { ITokenService } from '../ports/token-service.port.js';

export interface RefreshTokenCommand {
  refreshToken: string;
  tenantId?: string;
  deviceFingerprint?: string;
}

export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, AuthTokensDto> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly tokenService: ITokenService,
    private readonly ssoSessionRepo?: ISsoSessionRepository
  ) {}

  async execute(command: RefreshTokenCommand): Promise<Result<AuthTokensDto>> {
    let decoded;
    try {
      decoded = this.tokenService.verifyRefreshToken(command.refreshToken, command.deviceFingerprint);
    } catch (err: any) {
      return Result.fail(err.message || 'Invalid or expired refresh token');
    }

    if (command.tenantId && decoded.tenantId !== command.tenantId) {
      return Result.fail('Refresh token does not belong to the requested tenant');
    }

    const tenant = await this.tenantRepo.findById(decoded.tenantId);
    if (tenant && !tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }

    const user = await this.userRepo.findById(decoded.sub, decoded.tenantId);
    if (!user || !user.isActive) {
      return Result.fail('User account not found or disabled');
    }

    let nextRefreshJti: string | undefined;
    if (this.ssoSessionRepo && decoded.sid) {
      const session = await this.ssoSessionRepo.findById(decoded.sid);
      if (!session || !session.isActive()) {
        return Result.fail('SSO session has expired or been logged out');
      }

      // Refresh token rotation + reuse detection
      if (decoded.jti && session.refreshTokenJti && decoded.jti !== session.refreshTokenJti) {
        session.revoke('Refresh token reuse detected');
        await this.ssoSessionRepo.update(session);
        return Result.fail('Refresh token has already been used; session revoked for security');
      }

      nextRefreshJti = crypto.randomUUID();
      session.rotateRefreshToken(nextRefreshJti);
      await this.ssoSessionRepo.update(session);
    }

    const tokens = this.tokenService.issueTokens(user, {
      tenantId: user.tenantId,
      tenantSlug: tenant?.slug || decoded.tenantSlug,
      authMethod: (decoded.authMethod as any) || user.authMethod,
      provider: decoded.provider,
      sessionId: decoded.sid,
      refreshTokenJti: nextRefreshJti,
      expiresInSeconds: tenant?.config.sessionTtlSeconds,
      deviceFingerprint: command.deviceFingerprint
    });

    return Result.ok(tokens);
  }
}
