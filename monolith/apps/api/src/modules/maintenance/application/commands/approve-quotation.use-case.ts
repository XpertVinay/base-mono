import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { MaintenanceRequestDto } from '@monolith/contracts';

export interface ApproveQuotationInput {
  requestId: string;
  quotationId: string;
  actorRole: string;
  caretakerSpendingLimit?: number;
}

export class ApproveQuotationUseCase implements IUseCase<ApproveQuotationInput, MaintenanceRequestDto> {
  constructor(private readonly maintenanceRepository: IMaintenanceRepository) {}

  async execute(input: ApproveQuotationInput): Promise<Result<MaintenanceRequestDto, Error>> {
    try {
      const request = await this.maintenanceRepository.findById(input.requestId);
      if (!request) {
        return Result.fail(new Error(`Maintenance request ${input.requestId} not found`));
      }

      request.approveQuotation(input.quotationId, input.actorRole, input.caretakerSpendingLimit || 0);
      await this.maintenanceRepository.update(request);

      return Result.ok({
        id: request.id,
        propertyId: request.propertyId,
        reporterId: request.reporterId,
        reporterRole: request.reporterRole,
        category: request.category,
        priority: request.priority,
        status: request.status,
        title: request.title,
        description: request.description,
        photoUrls: request.photoUrls,
        sla: request.sla,
        isEmergencyFloatCovered: request.isEmergencyFloatCovered,
        emergencyAmountDrawn: request.emergencyAmountDrawn,
        selectedQuotation: request.selectedQuotation || undefined,
        proofOfWork: request.proofOfWork || undefined,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
