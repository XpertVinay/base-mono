import { IUseCase } from '../../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { TotpService } from '../../../domain/services/totp.service.js';
import { ICryptoService } from '../../../../../shared/infrastructure/crypto.service.js';
import { tokenService, ClientContext } from '../../../../../shared/infrastructure/token.service.js';
import { MfaDisableRequestDto, AuthTokensDto } from '@monolith/contracts';
import { UnauthorizedError, NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export interface DisableMfaInput extends MfaDisableRequestDto {
  userId: string;
  clientContext?: ClientContext;
}

export interface DisableMfaOutput {
  success: boolean;
  tokens: AuthTokensDto;
}

export class DisableMfaUseCase implements IUseCase<DisableMfaInput, DisableMfaOutput> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly cryptoService: ICryptoService,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async execute(input: DisableMfaInput): Promise<Result<DisableMfaOutput, Error>> {
    try {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        return Result.fail(new NotFoundError('User'));
      }

      if (!user.mfaEnabled || !user.mfaSecret) {
        return Result.fail(new UnauthorizedError('MFA is not enabled'));
      }

      // 1. Password check if password is provided
      if (input.password) {
        const isMatch = await this.cryptoService.comparePassword(input.password, user.password.value);
        if (!isMatch) {
          await this.auditRepository?.log({
            userId: user.id,
            eventType: 'IAM_MFA_DISABLE_FAILED',
            ipAddress: input.clientContext?.ip,
            userAgent: input.clientContext?.userAgent,
            details: { reason: 'Incorrect password' },
            status: 'FAILURE'
          });
          return Result.fail(new UnauthorizedError('Invalid password'));
        }
      }

      // 2. MFA code check
      let isVerified = TotpService.verifyTotp(input.code, user.mfaSecret);
      if (!isVerified) {
        const hashedCode = TotpService.hashBackupCode(input.code);
        isVerified = user.consumeBackupCode(hashedCode);
      }

      if (!isVerified) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_MFA_DISABLE_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { reason: 'Invalid MFA verification code' },
          status: 'FAILURE'
        });
        return Result.fail(new UnauthorizedError('Invalid MFA code for deactivation'));
      }

      // 3. Disable MFA and persist
      user.disableMfa();
      await this.userRepository.save(user);

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_MFA_DISABLED',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { email: user.email },
        status: 'SUCCESS'
      });

      // 4. Issue downgraded standard tokens
      const tokens = tokenService.generateTokens(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        input.clientContext,
        false
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
          mfaEnabled: false,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString()
        },
        mfaVerified: false
      };

      return Result.ok({
        success: true,
        tokens: tokensDto
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

