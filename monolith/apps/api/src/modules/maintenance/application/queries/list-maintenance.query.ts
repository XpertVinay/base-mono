import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { MaintenanceRequestDto } from '@monolith/contracts';

export interface ListMaintenanceInput {
  propertyId?: string;
  reporterId?: string;
}

export class ListMaintenanceQuery implements IUseCase<ListMaintenanceInput, MaintenanceRequestDto[]> {
  constructor(private readonly maintenanceRepository: IMaintenanceRepository) {}

  async execute(input: ListMaintenanceInput): Promise<Result<MaintenanceRequestDto[], Error>> {
    try {
      let list = [];
      if (input.propertyId) {
        list = await this.maintenanceRepository.findByPropertyId(input.propertyId);
      } else if (input.reporterId) {
        list = await this.maintenanceRepository.findByReporterId(input.reporterId);
      } else {
        list = await this.maintenanceRepository.findAll();
      }

      const dtos: MaintenanceRequestDto[] = list.map(req => ({
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
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
