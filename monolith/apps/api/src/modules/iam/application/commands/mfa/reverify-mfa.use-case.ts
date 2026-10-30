import { IUseCase } from '../../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { TotpService } from '../../../domain/services/totp.service.js';
import { tokenService, ClientContext } from '../../../../../shared/infrastructure/token.service.js';
import { MfaReverifyRequestDto, AuthTokensDto } from '@monolith/contracts';
import { UnauthorizedError, NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export interface ReverifyMfaInput extends MfaReverifyRequestDto {
  userId: string;
  clientContext?: ClientContext;
}

export class ReverifyMfaUseCase implements IUseCase<ReverifyMfaInput, AuthTokensDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async execute(input: ReverifyMfaInput): Promise<Result<AuthTokensDto, Error>> {
    try {
      if (!input.code) {
        return Result.fail(new UnauthorizedError('MFA verification code is required for re-verification'));
      }

      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        return Result.fail(new NotFoundError('User'));
      }

      if (!user.isActive) {
        return Result.fail(new UnauthorizedError('Account is inactive'));
      }

      if (!user.mfaEnabled || !user.mfaSecret) {
        return Result.fail(new UnauthorizedError('MFA is not enabled on this account'));
      }

      // Check TOTP code or backup code
      let isVerified = TotpService.verifyTotp(input.code, user.mfaSecret);
      let methodUsed = 'totp';

      if (!isVerified) {
        const hashedCode = TotpService.hashBackupCode(input.code);
        const consumed = user.consumeBackupCode(hashedCode);
        if (consumed) {
          isVerified = true;
          methodUsed = 'backup_code';
        }
      }

      if (!isVerified) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_MFA_REVERIFY_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: user.email, reason: 'Invalid TOTP or backup code during re-verification' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Invalid MFA code for re-verification'));
      }

      // Reset the 24-hour expiration window clock
      user.recordMfaVerification();
      await this.userRepository.save(user);

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_MFA_REVERIFIED',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { email: user.email, method: methodUsed, renewedWindowHours: 24 },
        status: 'SUCCESS'
      });

      // Issue freshly renewed tokens with updated mfaVerifiedAt
      const now = Date.now();
      const tokens = tokenService.generateTokens(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        input.clientContext,
        true,
        now
      );

      const tokensDto: AuthTokensDto = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          mfaEnabled: true,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        mfaVerified: true,
        mfaVerifiedAt: new Date(now).toISOString()
      };

      return Result.ok(tokensDto);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

