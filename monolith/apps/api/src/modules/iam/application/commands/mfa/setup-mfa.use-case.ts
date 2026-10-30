import { IUseCase } from '../../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../../shared/domain/result.js';
import { IUserRepository } from '../../../domain/repositories/user-repository.interface.js';
import { TotpService } from '../../../domain/services/totp.service.js';
import { MfaSetupResponseDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../../shared/presentation/error-handler.middleware.js';
import { IIamAuditRepository } from '../../../infrastructure/persistence/iam-audit.repository.js';
import { ClientContext } from '../../../../../shared/infrastructure/token.service.js';

export interface SetupMfaInput {
  userId: string;
  clientContext?: ClientContext;
}

export class SetupMfaUseCase implements IUseCase<SetupMfaInput, MfaSetupResponseDto> {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly auditRepository?: IIamAuditRepository
  ) {}

  async execute(input: SetupMfaInput): Promise<Result<MfaSetupResponseDto, Error>> {
    try {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        return Result.fail(new NotFoundError('User'));
      }

      // Generate high-entropy secret, backup codes, and QR code URI
      const secret = TotpService.generateSecret(20);
      const { plainCodes } = TotpService.generateBackupCodes(8);
      const otpauthUrl = TotpService.generateOtpauthUrl(user.email, secret, 'Monolith');

      await this.auditRepository?.log({
        userId: user.id,
        eventType: 'IAM_MFA_SETUP_INITIATED',
        ipAddress: input.clientContext?.ip,
        userAgent: input.clientContext?.userAgent,
        details: { email: user.email },
        status: 'SUCCESS'
      });

      return Result.ok({
        secret,
        otpauthUrl,
        backupCodes: plainCodes
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

