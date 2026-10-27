import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IMaintenanceRepository } from '../../domain/repositories/maintenance-repository.interface.js';
import { SubmitQuotationDto, QuotationDto } from '@monolith/contracts';

export interface SubmitQuotationInput extends SubmitQuotationDto {
  requestId: string;
}

export class SubmitQuotationUseCase implements IUseCase<SubmitQuotationInput, QuotationDto> {
  constructor(private readonly maintenanceRepository: IMaintenanceRepository) {}

  async execute(input: SubmitQuotationInput): Promise<Result<QuotationDto, Error>> {
    try {
      const request = await this.maintenanceRepository.findById(input.requestId);
      if (!request) {
        return Result.fail(new Error(`Maintenance request ${input.requestId} not found`));
      }

      const quotation = request.addQuotation(
        input.vendorId,
        input.vendorName,
        input.estimatedCost,
        input.breakdown
      );

      await this.maintenanceRepository.update(request);

      return Result.ok(quotation);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
