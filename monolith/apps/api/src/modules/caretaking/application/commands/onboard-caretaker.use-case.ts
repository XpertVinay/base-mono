import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerProfile } from '../../domain/entities/caretaker-profile.entity.js';
import { CreateCaretakerProfileRequestDto, CaretakerProfileDto } from '@monolith/contracts';

export interface OnboardCaretakerInput extends CreateCaretakerProfileRequestDto {
  userId: string;
  name?: string;
}

export class OnboardCaretakerUseCase implements IUseCase<OnboardCaretakerInput, CaretakerProfileDto> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: OnboardCaretakerInput): Promise<Result<CaretakerProfileDto, Error>> {
    try {
      const existing = await this.caretakingRepository.findProfileByUserId(input.userId);
      if (existing) {
        return Result.fail(new Error('Caretaker profile already exists for this user'));
      }

      const profile = CaretakerProfile.create(
        input.userId,
        input.phone,
        input.experienceYears,
        input.serviceCities,
        input.skills
      );

      await this.caretakingRepository.saveProfile(profile);

      return Result.ok({
        id: profile.id,
        userId: profile.userId,
        name: input.name || 'Caretaker',
        phone: profile.phone,
        experienceYears: profile.experienceYears,
        serviceCities: profile.serviceCities,
        skills: profile.skills,
        kycStatus: profile.kycStatus,
        ratingAverage: profile.ratingAverage,
        completedTasksCount: profile.completedTasksCount,
        isAvailable: profile.isAvailable,
        createdAt: profile.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
