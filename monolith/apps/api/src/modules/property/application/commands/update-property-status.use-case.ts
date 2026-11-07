import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { PropertyDto, PropertyStatus } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';

export interface UpdatePropertyStatusInput {
  propertyId: string;
  actorId: string;
  status: PropertyStatus;
  reason?: string;
  tenantId?: string;
}

export class UpdatePropertyStatusUseCase implements IUseCase<UpdatePropertyStatusInput, PropertyDto> {
  constructor(
    private readonly propertyRepository: IPropertyRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: UpdatePropertyStatusInput): Promise<Result<PropertyDto, Error>> {
    try {
      const property = await this.propertyRepository.findById(input.propertyId, input.tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${input.propertyId}'`));
      }

      // Security check: Only owner or admin may update property status
      if (property.ownerId !== input.actorId && input.actorId !== 'SYSTEM' && input.actorId !== 'ADMIN') {
        return Result.fail(new ForbiddenError('Only property owner or admin may update property status'));
      }

      const previousStatus = property.status;
      property.updateStatus(input.status, input.reason);
      await this.propertyRepository.update(property);

      if (this.eventBus) {
        await this.eventBus.publish({
          id: property.id,
          eventName: 'property.status_changed',
          aggregateId: property.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            propertyId: property.id,
            tenantId: property.tenantId,
            previousStatus,
            newStatus: property.status,
            updatedBy: input.actorId,
            reason: input.reason
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
