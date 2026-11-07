import { Router } from 'express';
import { IPropertyRepository } from './domain/repositories/property-repository.interface.js';
import { PostgresPropertyRepository } from './infrastructure/persistence/postgres-property.repository.js';
import { CreatePropertyUseCase } from './application/commands/create-property.use-case.js';
import { UpdatePropertyStatusUseCase } from './application/commands/update-property-status.use-case.js';
import { ListPropertiesQuery } from './application/queries/list-properties.query.js';
import { GetPropertyDetailsQuery } from './application/queries/get-property-details.query.js';
import {
  CreatePropertyUnitUseCase,
  ListPropertyUnitsQuery,
  UpdateUnitStatusUseCase,
  SetOwnershipSplitsUseCase,
  GetOwnershipSplitsQuery
} from './application/commands/property-units.use-cases.js';
import { PropertyController } from './presentation/http/property.controller.js';
import { createPropertyRouter } from './presentation/http/property.routes.js';
import { container } from '../../bootstrap/container.js';
import { eventBus, IEventBus } from '../../infrastructure/messaging/event-bus.js';
import { PropertyDto, PropertyUnitDto, OwnershipSplitDto } from '@monolith/contracts';

export interface IPropertyModulePublicApi {
  getPropertyById(id: string, tenantId?: string): Promise<PropertyDto | null>;
  verifyOwner(propertyId: string, ownerId: string, tenantId?: string): Promise<boolean>;
  getEmergencyFloatLimit(propertyId: string, tenantId?: string): Promise<number>;
  getUnits(propertyId: string, tenantId?: string): Promise<PropertyUnitDto[]>;
  getOwnershipSplits(propertyId: string, tenantId?: string): Promise<OwnershipSplitDto[]>;
}

export class PropertyModule {
  public static init(
    customRepository?: IPropertyRepository,
    customEventBus?: IEventBus
  ): {
    router: Router;
    publicApi: IPropertyModulePublicApi;
    repository: IPropertyRepository;
  } {
    const repository = customRepository || new PostgresPropertyRepository();
    const effectiveEventBus = customEventBus || eventBus;

    const createPropertyUseCase = new CreatePropertyUseCase(repository, effectiveEventBus);
    const updatePropertyStatusUseCase = new UpdatePropertyStatusUseCase(repository, effectiveEventBus);
    const listPropertiesQuery = new ListPropertiesQuery(repository);
    const getPropertyDetailsQuery = new GetPropertyDetailsQuery(repository);

    const createUnitUseCase = new CreatePropertyUnitUseCase(repository, effectiveEventBus);
    const listUnitsQuery = new ListPropertyUnitsQuery(repository);
    const updateUnitStatusUseCase = new UpdateUnitStatusUseCase(repository, effectiveEventBus);
    const setOwnershipSplitsUseCase = new SetOwnershipSplitsUseCase(repository, effectiveEventBus);
    const getOwnershipSplitsQuery = new GetOwnershipSplitsQuery(repository);

    const controller = new PropertyController(
      createPropertyUseCase,
      updatePropertyStatusUseCase,
      listPropertiesQuery,
      getPropertyDetailsQuery,
      createUnitUseCase,
      listUnitsQuery,
      updateUnitStatusUseCase,
      setOwnershipSplitsUseCase,
      getOwnershipSplitsQuery
    );
    const router = createPropertyRouter(controller);

    const publicApi: IPropertyModulePublicApi = {
      getPropertyById: async (id: string, tenantId?: string) => {
        const property = await repository.findById(id, tenantId);
        if (!property) return null;
        return {
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
        };
      },
      verifyOwner: async (propertyId: string, ownerId: string, tenantId?: string) => {
        const property = await repository.findById(propertyId, tenantId);
        return property ? property.ownerId === ownerId : false;
      },
      getEmergencyFloatLimit: async (propertyId: string, tenantId?: string) => {
        const property = await repository.findById(propertyId, tenantId);
        return property ? property.emergencyFloatLimit : 0;
      },
      getUnits: async (propertyId: string, tenantId?: string) => {
        const res = await listUnitsQuery.execute({ propertyId, tenantId });
        return res.isSuccess ? res.getValue() : [];
      },
      getOwnershipSplits: async (propertyId: string, tenantId?: string) => {
        const res = await getOwnershipSplitsQuery.execute({ propertyId, tenantId });
        return res.isSuccess ? res.getValue() : [];
      }
    };

    container.register('IPropertyModulePublicApi', publicApi);
    return { router, publicApi, repository };
  }
}
