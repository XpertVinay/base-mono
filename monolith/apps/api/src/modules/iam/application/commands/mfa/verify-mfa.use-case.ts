import { IUseCase } from '../../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { TotpService } from '../../../domain/services/totp.service.js';
import { tokenService, ClientContext } from '../../../../../shared/infrastructure/token.service.js';
import { MfaVerifyRequestDto, AuthTokensDto } from '@monolith/contracts';
import { UnauthorizedError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export interface VerifyMfaInput extends MfaVerifyRequestDto {
  clientContext?: ClientContext;
}

export class VerifyMfaUseCase implements IUseCase<VerifyMfaInput, AuthTokensDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async execute(input: VerifyMfaInput): Promise<Result<AuthTokensDto, Error>> {
    try {
      if (!input.mfaChallengeToken) {
        return Result.fail(new UnauthorizedError('MFA challenge token is required'));
      }
      if (!input.code) {
        return Result.fail(new UnauthorizedError('MFA verification code is required'));
      }

      // 1. Verify and decrypt device-bound MFA challenge token
      const challengeClaims = tokenService.verifyMfaChallengeToken(input.mfaChallengeToken, input.clientContext);

      const user = await this.userRepository.findById(challengeClaims.id);
      if (!user) {
        return Result.fail(new UnauthorizedError('User account not found'));
      }

      if (!user.isActive) {
        return Result.fail(new UnauthorizedError('Account is inactive'));
      }

      if (!user.mfaEnabled || !user.mfaSecret) {
        return Result.fail(new UnauthorizedError('MFA is not configured for this account'));
      }

      // 2. Validate Code: Try TOTP first
      let isVerified = TotpService.verifyTotp(input.code, user.mfaSecret);
      let methodUsed = 'totp';

      // 3. Fallback to single-use Backup Recovery Code
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
          eventType: 'IAM_MFA_VERIFICATION_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { email: user.email, reason: 'Incorrect TOTP or backup code' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Invalid MFA verification code or backup code'));
      }

      // 4. Update user verification timestamp and persist
      user.recordMfaVerification();
      await this.userRepository.save(user);

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_MFA_VERIFIED',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { email: user.email, method: methodUsed },
        status: 'SUCCESS'
      });

      // 5. Issue full-privilege tokens with active 24h MFA verification
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

