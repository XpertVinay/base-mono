import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignmentDto, AssignmentStatus } from '@monolith/contracts';

export interface ListAssignmentsInput {
  tenantId?: string;
  propertyId?: string;
  caretakerId?: string;
  ownerId?: string;
  status?: AssignmentStatus;
}

export class ListAssignmentsQuery implements IUseCase<ListAssignmentsInput, CaretakerAssignmentDto[]> {
  constructor(private readonly caretakingRepository: ICaretakingRepository) {}

  async execute(input: ListAssignmentsInput): Promise<Result<CaretakerAssignmentDto[], Error>> {
    try {
      const assignments = await this.caretakingRepository.findAssignments(input);

      const dtos: CaretakerAssignmentDto[] = assignments.map(a => ({
        id: a.id,
        tenantId: a.tenantId,
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
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
