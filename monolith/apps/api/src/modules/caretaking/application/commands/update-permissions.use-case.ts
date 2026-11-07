import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignmentDto, PermissionScope } from '@monolith/contracts';

export interface UpdatePermissionsInput {
  assignmentId: string;
  ownerId: string;
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit?: number;
  tenantId?: string;
}

export class UpdatePermissionsUseCase implements IUseCase<UpdatePermissionsInput, CaretakerAssignmentDto> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: UpdatePermissionsInput): Promise<Result<CaretakerAssignmentDto, Error>> {
    try {
      const assignment = await this.caretakingRepository.findAssignmentById(input.assignmentId, input.tenantId);
      if (!assignment) {
        return Result.fail(new Error(`Assignment ${input.assignmentId} not found`));
      }

      if (input.tenantId && assignment.tenantId && assignment.tenantId !== input.tenantId) {
        return Result.fail(new Error('Cross-tenant assignment access denied'));
      }

      if (assignment.ownerId !== input.ownerId) {
        return Result.fail(new Error('Unauthorized: Only property owner may modify assignment permissions'));
      }

      assignment.updatePermissions(input.allowedPermissions, input.spendingThresholdLimit);
      await this.caretakingRepository.updateAssignment(assignment);

      return Result.ok({
        id: assignment.id,
        tenantId: assignment.tenantId,
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
        terminatedAt: assignment.terminatedAt ? assignment.terminatedAt.toISOString() : undefined,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
