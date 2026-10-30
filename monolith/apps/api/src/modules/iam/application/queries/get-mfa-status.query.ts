import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { MfaStatusResponseDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface GetMfaStatusInput {
  userId: string;
}

export class GetMfaStatusQuery implements IQuery<GetMfaStatusInput, MfaStatusResponseDto> {
  // 24 hours (in seconds)
  private readonly REVERIFICATION_WINDOW_SECONDS = 24 * 3600;

  constructor(private readonly userRepository: IUserRepository) { }

  async execute(input: GetMfaStatusInput): Promise<Result<MfaStatusResponseDto, Error>> {
    try {
      const user = await this.userRepository.findById(input.userId);
      if (!user) {
        return Result.fail(new NotFoundError('User'));
      }

      const methods: string[] = [];
      if (user.mfaEnabled) {
        methods.push('totp');
        if (user.mfaBackupCodes.length > 0) {
          methods.push('backup_code');
        }
      }

      return Result.ok({
        enabled: user.mfaEnabled,
        enrolledAt: user.mfaEnrolledAt ? user.mfaEnrolledAt.toISOString() : null,
        lastVerifiedAt: user.mfaLastVerifiedAt ? user.mfaLastVerifiedAt.toISOString() : null,
        methods,
        reverificationWindowSeconds: this.REVERIFICATION_WINDOW_SECONDS
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
