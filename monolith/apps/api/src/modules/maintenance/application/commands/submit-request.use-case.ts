import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { MaintenanceRequest } from '../../domain/entities/maintenance-request.entity.js';
import { CreateMaintenanceRequestDto, MaintenanceRequestDto } from '@monolith/contracts';

export interface SubmitRequestInput extends CreateMaintenanceRequestDto {
  reporterId: string;
  reporterRole: string;
  ownerEmergencyLimit?: number;
}

export class SubmitRequestUseCase implements IUseCase<SubmitRequestInput, MaintenanceRequestDto> {
  constructor(private readonly maintenanceRepository: IMaintenanceRepository) {}

  async execute(input: SubmitRequestInput): Promise<Result<MaintenanceRequestDto, Error>> {
    try {
      const request = MaintenanceRequest.create(
        input.propertyId,
        input.reporterId,
        input.reporterRole,
        input.category,
        input.title,
        input.description,
        input.photoUrls || [],
        input.reportedUrgency || 'NORMAL',
        input.ownerEmergencyLimit ?? 5000
      );

      await this.maintenanceRepository.save(request);

      return Result.ok(this.toDto(request));
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  private toDto(req: MaintenanceRequest): MaintenanceRequestDto {
    return {
      id: req.id,
      propertyId: req.propertyId,
      reporterId: req.reporterId,
      reporterRole: req.reporterRole,
      category: req.category,
      priority: req.priority,
      status: req.status,
      title: req.title,
      description: req.description,
      photoUrls: req.photoUrls,
      sla: req.sla,
      isEmergencyFloatCovered: req.isEmergencyFloatCovered,
      emergencyAmountDrawn: req.emergencyAmountDrawn,
      selectedQuotation: req.selectedQuotation || undefined,
      proofOfWork: req.proofOfWork || undefined,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString()
    };
  }
}
