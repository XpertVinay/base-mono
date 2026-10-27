import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerProfileDto } from '@monolith/contracts';

export class ListCaretakersQuery implements IUseCase<void, CaretakerProfileDto[]> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(): Promise<Result<CaretakerProfileDto[], Error>> {
    try {
      const profiles = await this.caretakingRepository.findAllProfiles();
      const dtos: CaretakerProfileDto[] = profiles.map(p => ({
        id: p.id,
        userId: p.userId,
        name: 'Verified Caretaker',
        phone: p.phone,
        experienceYears: p.experienceYears,
        serviceCities: p.serviceCities,
        skills: p.skills,
        kycStatus: p.kycStatus,
        ratingAverage: p.ratingAverage,
        completedTasksCount: p.completedTasksCount,
        isAvailable: p.isAvailable,
        createdAt: p.createdAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
