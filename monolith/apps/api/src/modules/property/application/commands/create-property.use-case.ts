import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { Property } from '../../domain/entities/property.entity.js';
import { CreatePropertyRequestDto, PropertyDto } from '@monolith/contracts';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';

export interface CreatePropertyInput extends CreatePropertyRequestDto {
  ownerId: string;
}

export class CreatePropertyUseCase implements IUseCase<CreatePropertyInput, PropertyDto> {
  constructor(
    private readonly propertyRepository: IPropertyRepository,
    private readonly eventBus?: IEventBus
  ) {}

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
        input.emergencyFloatLimit ?? 5000,
        input.tenantId
      );

      await this.propertyRepository.save(property);

      if (this.eventBus) {
        await this.eventBus.publish({
          id: property.id,
          eventName: 'property.registered',
          aggregateId: property.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            propertyId: property.id,
            tenantId: property.tenantId,
            ownerId: property.ownerId,
            title: property.title,
            category: property.category,
            status: property.status,
            emergencyFloatLimit: property.emergencyFloatLimit
          }
        });
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
