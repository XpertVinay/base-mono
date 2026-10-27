import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { TenantLead } from '../../domain/entities/tenant-lead.entity.js';
import { TenantLeadDto } from '@monolith/contracts';

export interface ListLeadsInput {
  listingId?: string;
  propertyId?: string;
}

export class ListLeadsQuery implements IUseCase<ListLeadsInput, TenantLeadDto[]> {
  constructor(private readonly rentalRepository: IRentalRepository) {}

  async execute(input: ListLeadsInput): Promise<Result<TenantLeadDto[], Error>> {
    try {
      let leads: TenantLead[] = [];
      if (input.listingId) {
        leads = await this.rentalRepository.findLeadsByListingId(input.listingId);
      } else if (input.propertyId) {
        leads = await this.rentalRepository.findLeadsByPropertyId(input.propertyId);
      } else {
        leads = [];
      }

      const dtos: TenantLeadDto[] = leads.map(lead => ({
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
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
