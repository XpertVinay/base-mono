import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { TenantLead } from '../../domain/entities/tenant-lead.entity.js';
import { CreateTenantLeadRequestDto, TenantLeadDto } from '@monolith/contracts';

export class CreateLeadUseCase implements IUseCase<CreateTenantLeadRequestDto, TenantLeadDto> {
  constructor(private readonly rentalRepository: IRentalRepository) {}

  async execute(input: CreateTenantLeadRequestDto): Promise<Result<TenantLeadDto, Error>> {
    try {
      const listing = await this.rentalRepository.findListingById(input.listingId);
      if (!listing) {
        return Result.fail(new Error(`Rental listing ${input.listingId} not found`));
      }

      const lead = TenantLead.create(
        input.listingId,
        listing.propertyId,
        input.tenantName,
        input.tenantPhone,
        input.tenantEmail,
        input.offeredRent ?? null,
        input.notes ?? ''
      );

      await this.rentalRepository.saveLead(lead);

      return Result.ok({
        id: lead.id,
        listingId: lead.listingId,
        propertyId: lead.propertyId,
        tenantName: lead.tenantName,
        tenantPhone: lead.tenantPhone,
        tenantEmail: lead.tenantEmail,
        status: lead.status,
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
