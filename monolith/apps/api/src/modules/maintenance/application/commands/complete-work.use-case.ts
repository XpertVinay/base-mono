import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { CompleteMaintenanceWorkDto, MaintenanceRequestDto } from '@monolith/contracts';

export interface CompleteWorkInput extends CompleteMaintenanceWorkDto {
  requestId: string;
}

export class CompleteWorkUseCase implements IUseCase<CompleteWorkInput, MaintenanceRequestDto> {
  constructor(private readonly maintenanceRepository: IMaintenanceRepository) {}

  async execute(input: CompleteWorkInput): Promise<Result<MaintenanceRequestDto, Error>> {
    try {
      const request = await this.maintenanceRepository.findById(input.requestId);
      if (!request) {
        return Result.fail(new Error(`Maintenance request ${input.requestId} not found`));
      }

      request.completeWork({
        beforePhotoUrls: input.beforePhotoUrls,
        afterPhotoUrls: input.afterPhotoUrls,
        receiptUrls: input.receiptUrls,
        gpsLatitude: input.gpsLatitude,
        gpsLongitude: input.gpsLongitude,
        vendorSignatureTimestamp: new Date().toISOString(),
        caretakerVerifiedTimestamp: new Date().toISOString(),
        finalCost: input.finalCost
      });

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
