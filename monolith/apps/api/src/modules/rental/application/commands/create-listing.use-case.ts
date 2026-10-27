import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { RentalListing } from '../../domain/entities/rental-listing.entity.js';
import { CreateRentalListingRequestDto, RentalListingDto } from '@monolith/contracts';

export interface CreateListingInput extends CreateRentalListingRequestDto {
  ownerId: string;
}

export class CreateListingUseCase implements IUseCase<CreateListingInput, RentalListingDto> {
  constructor(private readonly rentalRepository: IRentalRepository) {}

  async execute(input: CreateListingInput): Promise<Result<RentalListingDto, Error>> {
    try {
      const existing = await this.rentalRepository.findListingByPropertyId(input.propertyId);
      if (existing && existing.status !== 'LEASED') {
        return Result.fail(new Error('Active or draft rental listing already exists for this property'));
      }

      const availableFrom = input.availableFrom ? new Date(input.availableFrom) : new Date();

      const listing = RentalListing.create(
        input.propertyId,
        input.ownerId,
        input.monthlyRent,
        input.securityDeposit,
        input.leaseDurationMonths ?? 11,
        availableFrom,
        input.permittedUse ?? 'RESIDENTIAL',
        input.description ?? ''
      );

      // Auto-publish
      listing.publish();
      await this.rentalRepository.saveListing(listing);

      return Result.ok({
        id: listing.id,
        propertyId: listing.propertyId,
        ownerId: listing.ownerId,
        monthlyRent: listing.monthlyRent,
        securityDeposit: listing.securityDeposit,
        leaseDurationMonths: listing.leaseDurationMonths,
        availableFrom: listing.availableFrom.toISOString(),
        permittedUse: listing.permittedUse,
        description: listing.description,
        status: listing.status,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
