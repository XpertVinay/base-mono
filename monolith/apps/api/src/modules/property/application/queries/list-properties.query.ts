import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { PropertyDto } from '@monolith/contracts';

export interface ListPropertiesInput {
  ownerId?: string;
  role?: string;
}

export class ListPropertiesQuery implements IUseCase<ListPropertiesInput, PropertyDto[]> {
  constructor(private readonly propertyRepository: IPropertyRepository) {}

  async execute(input: ListPropertiesInput): Promise<Result<PropertyDto[], Error>> {
    try {
      const properties = input.ownerId
        ? await this.propertyRepository.findByOwnerId(input.ownerId)
        : await this.propertyRepository.findAll();

      const dtos: PropertyDto[] = properties.map(property => ({
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
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
