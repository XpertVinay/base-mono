import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignment } from '../../domain/entities/caretaker-assignment.entity.js';
import { CaretakerAssignmentDto } from '@monolith/contracts';

export interface ListAssignmentsInput {
  propertyId?: string;
  caretakerId?: string;
  ownerId?: string;
}

export class ListAssignmentsQuery implements IUseCase<ListAssignmentsInput, CaretakerAssignmentDto[]> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: ListAssignmentsInput): Promise<Result<CaretakerAssignmentDto[], Error>> {
    try {
      let assignments: CaretakerAssignment[] = [];
      if (input.propertyId) {
        assignments = await this.caretakingRepository.findAssignmentsByPropertyId(input.propertyId);
      } else if (input.ownerId) {
        assignments = await this.caretakingRepository.findAssignmentsByOwnerId(input.ownerId);
      } else if (input.caretakerId) {
        assignments = await this.caretakingRepository.findAssignmentsByCaretakerId(input.caretakerId);
      } else {
        assignments = [];
      }

      const dtos: CaretakerAssignmentDto[] = assignments.map(a => ({
        id: a.id,
        propertyId: a.propertyId,
        caretakerId: a.caretakerId,
        ownerId: a.ownerId,
        status: a.status,
        startDate: a.startDate.toISOString(),
        endDate: a.endDate ? a.endDate.toISOString() : undefined,
        monthlyFee: a.monthlyFee,
        allowedPermissions: a.allowedPermissions,
        spendingThresholdLimit: a.spendingThresholdLimit,
        acceptedAt: a.acceptedAt ? a.acceptedAt.toISOString() : undefined,
        terminatedAt: a.terminatedAt ? a.terminatedAt.toISOString() : undefined,
        createdAt: a.createdAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
