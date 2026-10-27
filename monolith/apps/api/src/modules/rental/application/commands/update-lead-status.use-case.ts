import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { UpdateTenantLeadStatusRequestDto, TenantLeadDto } from '@monolith/contracts';

export interface UpdateLeadStatusInput extends UpdateTenantLeadStatusRequestDto {
  leadId: string;
}

export class UpdateLeadStatusUseCase implements IUseCase<UpdateLeadStatusInput, TenantLeadDto> {
  constructor(private readonly rentalRepository: IRentalRepository) {}

  async execute(input: UpdateLeadStatusInput): Promise<Result<TenantLeadDto, Error>> {
    try {
      const lead = await this.rentalRepository.findLeadById(input.leadId);
      if (!lead) {
        return Result.fail(new Error(`Lead ${input.leadId} not found`));
      }

      const visitDate = input.scheduledVisitDate ? new Date(input.scheduledVisitDate) : undefined;
      lead.updateStatus(input.status, visitDate, input.notes);

      await this.rentalRepository.updateLead(lead);

      // If converted, mark listing as LEASED
      if (input.status === 'CONVERTED') {
        const listing = await this.rentalRepository.findListingById(lead.listingId);
        if (listing) {
          listing.markLeased();
          await this.rentalRepository.updateListing(listing);
        }
      }

      return Result.ok({
        id: lead.id,
        listingId: lead.listingId,
        propertyId: lead.propertyId,
        tenantName: lead.tenantName,
        tenantPhone: lead.tenantPhone,
        tenantEmail: lead.tenantEmail,
        status: lead.status,
        scheduledVisitDate: lead.scheduledVisitDate ? lead.scheduledVisitDate.toISOString() : undefined,
        offeredRent: lead.offeredRent ?? undefined,
        notes: lead.notes,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
