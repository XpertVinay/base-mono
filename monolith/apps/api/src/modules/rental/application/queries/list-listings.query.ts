import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { RentalListingDto } from '@monolith/contracts';

export class ListListingsQuery implements IUseCase<void, RentalListingDto[]> {
  constructor(private readonly rentalRepository: IRentalRepository) {}

  async execute(): Promise<Result<RentalListingDto[], Error>> {
    try {
      const listings = await this.rentalRepository.findAllActiveListings();
      const dtos: RentalListingDto[] = listings.map(l => ({
        id: l.id,
        propertyId: l.propertyId,
        ownerId: l.ownerId,
        monthlyRent: l.monthlyRent,
        securityDeposit: l.securityDeposit,
        leaseDurationMonths: l.leaseDurationMonths,
        availableFrom: l.availableFrom.toISOString(),
        permittedUse: l.permittedUse,
        description: l.description,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
