import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignment } from '../../domain/entities/caretaker-assignment.entity.js';
import { AssignCaretakerRequestDto, CaretakerAssignmentDto } from '@monolith/contracts';

export interface AssignCaretakerInput extends AssignCaretakerRequestDto {
  ownerId: string;
}

export class AssignCaretakerUseCase implements IUseCase<AssignCaretakerInput, CaretakerAssignmentDto> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: AssignCaretakerInput): Promise<Result<CaretakerAssignmentDto, Error>> {
    try {
      // Check if there is already an active assignment for this property
      const active = await this.caretakingRepository.findActiveAssignmentByPropertyId(input.propertyId);
      if (active) {
        return Result.fail(new Error('Property already has an active caretaker assignment. Terminate it first.'));
      }

      const startDate = input.startDate ? new Date(input.startDate) : new Date();
      const endDate = input.endDate ? new Date(input.endDate) : null;

      const assignment = CaretakerAssignment.create(
        input.propertyId,
        input.caretakerId,
        input.ownerId,
        input.monthlyFee,
        input.allowedPermissions,
        input.spendingThresholdLimit ?? 0,
        startDate,
        endDate
      );

      await this.caretakingRepository.saveAssignment(assignment);

      return Result.ok({
        id: assignment.id,
        propertyId: assignment.propertyId,
        caretakerId: assignment.caretakerId,
        ownerId: assignment.ownerId,
        status: assignment.status,
        startDate: assignment.startDate.toISOString(),
        endDate: assignment.endDate ? assignment.endDate.toISOString() : undefined,
        monthlyFee: assignment.monthlyFee,
        allowedPermissions: assignment.allowedPermissions,
        spendingThresholdLimit: assignment.spendingThresholdLimit,
        createdAt: assignment.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
