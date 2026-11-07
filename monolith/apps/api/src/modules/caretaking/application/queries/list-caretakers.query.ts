import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerProfileDto } from '@monolith/contracts';

export interface ListCaretakersInput {
  tenantId?: string;
  serviceCity?: string;
  isAvailable?: boolean;
}

export class ListCaretakersQuery implements IUseCase<ListCaretakersInput | void, CaretakerProfileDto[]> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input?: ListCaretakersInput | void): Promise<Result<CaretakerProfileDto[], Error>> {
    try {
      const tenantId = input?.tenantId;
      let profiles = await this.caretakingRepository.findAllProfiles(tenantId);

      if (input?.serviceCity) {
        profiles = profiles.filter(p => p.serviceCities.includes(input.serviceCity!));
      }
      if (input?.isAvailable !== undefined) {
        profiles = profiles.filter(p => p.isAvailable === input.isAvailable);
      }

      const dtos: CaretakerProfileDto[] = profiles.map(p => ({
        id: p.id,
        tenantId: p.tenantId,
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
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
