import { IUseCase } from '../../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { TotpService } from '../../../domain/services/totp.service.js';
import { tokenService, ClientContext } from '../../../../../shared/infrastructure/token.service.js';
import { AuthTokensDto } from '@monolith/contracts';
import { BadRequestError, NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';

export interface EnableMfaInput {
  userId: string;
  code: string;
  secret: string;
  backupCodes?: string[];
  clientContext?: ClientContext;
}

export interface EnableMfaOutput {
  enabled: boolean;
  tokens: AuthTokensDto;
  backupCodes: string[];
}

export class EnableMfaUseCase implements IUseCase<EnableMfaInput, EnableMfaOutput> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async execute(input: EnableMfaInput): Promise<Result<EnableMfaOutput, Error>> {
    try {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        return Result.fail(new NotFoundError('User'));
      }

      // 1. Verify TOTP code against the secret provided during setup
      const isValid = TotpService.verifyTotp(input.code, input.secret);
      if (!isValid) {
        await this.auditRepository?.log({
          userId: user.id,
          eventType: 'IAM_MFA_ENABLE_FAILED',
          ipAddress: input.clientContext?.ip,
          userAgent: input.clientContext?.userAgent,
          details: { reason: 'Invalid TOTP code supplied during enablement' },
          status: 'FAILURE'
        });
        return Result.fail(new BadRequestError('Invalid MFA verification code'));
      }

      // 2. Prepare and hash backup codes
      let plainBackupCodes = input.backupCodes || [];
      let hashedBackupCodes: string[] = [];

      if (plainBackupCodes.length === 0) {
        const generated = TotpService.generateBackupCodes(8);
        plainBackupCodes = generated.plainCodes;
        hashedBackupCodes = generated.hashedCodes;
      } else {
        hashedBackupCodes = plainBackupCodes.map(c => TotpService.hashBackupCode(c));
      }

      // 3. Enable MFA on user aggregate and persist
      user.enableMfa(input.secret, hashedBackupCodes);
      await this.userRepository.save(user);

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_MFA_ENABLED',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { method: 'totp', backupCodesCount: hashedBackupCodes.length },
        status: 'SUCCESS'
      });

      // 4. Issue upgraded tokens with active MFA claims (24h validity window)
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

      return Result.ok({
        enabled: true,
        tokens: tokensDto,
        backupCodes: plainBackupCodes
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

