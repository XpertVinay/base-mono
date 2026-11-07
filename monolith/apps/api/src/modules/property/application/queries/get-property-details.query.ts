import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { PropertyDto } from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface GetPropertyDetailsInput {
  propertyId: string;
  tenantId?: string;
}

export class GetPropertyDetailsQuery implements IUseCase<GetPropertyDetailsInput, PropertyDto> {
  constructor(private readonly propertyRepository: IPropertyRepository) {}

  async execute(input: GetPropertyDetailsInput): Promise<Result<PropertyDto, Error>> {
    try {
      const property = await this.propertyRepository.findById(input.propertyId, input.tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${input.propertyId}'`));
      }

      return Result.ok({
        id: property.id,
        tenantId: property.tenantId,
        ownerId: property.ownerId,
        title: property.title,
        description: property.description,
        category: property.category,
        propertyType: property.propertyType,
        status: property.status,
        address: property.address,
        areaSqFt: property.areaSqFt,
        amenities: property.amenities,
        emergencyContact: property.emergencyContact,
        emergencyFloatLimit: property.emergencyFloatLimit,
        createdAt: property.createdAt.toISOString(),
        updatedAt: property.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
