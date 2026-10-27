import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignmentDto } from '@monolith/contracts';

export interface AcceptAssignmentInput {
  assignmentId: string;
  caretakerUserId: string;
}

export class AcceptAssignmentUseCase implements IUseCase<AcceptAssignmentInput, CaretakerAssignmentDto> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: AcceptAssignmentInput): Promise<Result<CaretakerAssignmentDto, Error>> {
    try {
      const assignment = await this.caretakingRepository.findAssignmentById(input.assignmentId);
      if (!assignment) {
        return Result.fail(new Error(`Assignment ${input.assignmentId} not found`));
      }

      // Verify the caretaker profile belongs to this user
      const profile = await this.caretakingRepository.findProfileByUserId(input.caretakerUserId);
      if (!profile || profile.id !== assignment.caretakerId) {
        return Result.fail(new Error('Unauthorized: Only the assigned caretaker may accept this assignment'));
      }

      assignment.accept(input.caretakerUserId);
      await this.caretakingRepository.updateAssignment(assignment);

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
        acceptedAt: assignment.acceptedAt ? assignment.acceptedAt.toISOString() : undefined,
        createdAt: assignment.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
