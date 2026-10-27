import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { PropertyDto, PropertyStatus } from '@monolith/contracts';

export interface UpdatePropertyStatusInput {
  propertyId: string;
  actorId: string;
  status: PropertyStatus;
  reason?: string;
}

export class UpdatePropertyStatusUseCase implements IUseCase<UpdatePropertyStatusInput, PropertyDto> {
  constructor(private readonly propertyRepository: IPropertyRepository) {}

  async execute(input: UpdatePropertyStatusInput): Promise<Result<PropertyDto, Error>> {
    try {
      const property = await this.propertyRepository.findById(input.propertyId);
      if (!property) {
        return Result.fail(new Error(`Property with id ${input.propertyId} not found`));
      }

      // Security check: Only owner can directly alter property status
      if (property.ownerId !== input.actorId) {
        return Result.fail(new Error('Unauthorized: Only property owner may update property status'));
      }

      property.updateStatus(input.status, input.reason);
      await this.propertyRepository.update(property);

      return Result.ok({
        id: property.id,
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
