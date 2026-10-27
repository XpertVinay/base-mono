import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { Property } from '../../domain/entities/property.entity.js';
import { CreatePropertyRequestDto, PropertyDto } from '@monolith/contracts';

export interface CreatePropertyInput extends CreatePropertyRequestDto {
  ownerId: string;
}

export class CreatePropertyUseCase implements IUseCase<CreatePropertyInput, PropertyDto> {
  constructor(private readonly propertyRepository: IPropertyRepository) {}

  async execute(input: CreatePropertyInput): Promise<Result<PropertyDto, Error>> {
    try {
      const property = Property.create(
        input.ownerId,
        input.title,
        input.description,
        input.category,
        input.propertyType,
        input.address,
        input.areaSqFt,
        input.emergencyContact,
        input.amenities || [],
        input.emergencyFloatLimit ?? 5000
      );

      await this.propertyRepository.save(property);

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
