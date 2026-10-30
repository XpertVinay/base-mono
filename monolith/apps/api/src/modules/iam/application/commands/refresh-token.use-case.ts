import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { tokenService, ClientContext } from '../../../../shared/infrastructure/token.service.js';
import { RefreshTokenRequestDto, AuthTokensDto } from '@monolith/contracts';
import { UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../infrastructure/persistence/iam-audit.repository.js';

export interface RefreshTokenUseCaseInput extends RefreshTokenRequestDto {
  clientContext?: ClientContext;
}

export class RefreshTokenUseCase implements IUseCase<RefreshTokenUseCaseInput, AuthTokensDto> {
  // 24 hours timeframe for MFA reverification validity
  private readonly MFA_MAX_AGE_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) { }

  async execute(input: RefreshTokenUseCaseInput): Promise<Result<AuthTokensDto, Error>> {
    try {
      if (!input.refreshToken) {
        return Result.fail(new UnauthorizedError('Refresh token is required'));
      }

      // Verify encrypted refresh token and client fingerprint (anti-session hijacking)
      const tokenClaims = tokenService.verifyRefreshToken(input.refreshToken, input.clientContext);

      const user = await this.userRepository.findById(tokenClaims.id);
      if (!user) {
        await this.auditRepository?.log({
          userId: tokenClaims.id,
          eventType: 'IAM_TOKEN_REFRESH_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { reason: 'User not found' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('User account not found'));
      }

      if (!user.isActive) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_TOKEN_REFRESH_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { reason: 'Account inactive' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Account is inactive'));
      }

      // Strict 24-hour expiration check for MFA verification on token refresh
      let mfaVerified = false;
      let mfaVerifiedAt: number | undefined;

      if (user.mfaEnabled) {
        const mfaAge = tokenClaims.mfaVerifiedAt ? Date.now() - tokenClaims.mfaVerifiedAt : Infinity;
        const isMfaActive = Boolean(tokenClaims.mfaVerified && mfaAge <= this.MFA_MAX_AGE_MS);

        if (isMfaActive) {
          mfaVerified = true;
          mfaVerifiedAt = tokenClaims.mfaVerifiedAt;
          await this.auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_TOKEN_REFRESHED',
            ipAddress: input.clientContext?.ip,
            userAgent: input.clientContext?.userAgent,
            details: { mfaVerified: true, mfaAgeMinutes: Math.round(mfaAge / 60000) },
            status: 'SUCCESS'
          });
        } else {
          // MFA 24h window has expired! Rotated tokens will NOT carry active MFA status
          mfaVerified = false;
          mfaVerifiedAt = undefined;
          await this.auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_TOKEN_MFA_EXPIRED',
            ipAddress: input.clientContext?.ip,
            userAgent: input.clientContext?.userAgent,
            details: {
              reason: 'MFA reverification window (24h) expired during token refresh. Reverification required for sensitive operations.',
              mfaAgeHours: tokenClaims.mfaVerifiedAt ? Math.round(mfaAge / 3600000) : null
            },
            status: 'SUCCESS'
          });
        }
      } else {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_TOKEN_REFRESHED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { mfaEnabled: false },
          status: 'SUCCESS'
        });
      }

      // Issue rotated, hardened tokens with evaluated MFA status and tenant context
      const tenantId = user.tenantId || tokenClaims.tenantId || input.clientContext?.tenantId;
      const tokens = tokenService.generateTokens(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId
        },
        input.clientContext,
        mfaVerified,
        mfaVerifiedAt
      );

      const tokensDto: AuthTokensDto = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        tenantId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId || tenantId,
          isActive: user.isActive,
          mfaEnabled: user.mfaEnabled,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        mfaVerified,
        mfaVerifiedAt: mfaVerifiedAt ? new Date(mfaVerifiedAt).toISOString() : undefined
      };

      return Result.ok(tokensDto);
    } catch (error: any) {
      return Result.fail(error);
    }
  }
}
