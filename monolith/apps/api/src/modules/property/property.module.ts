import { Router } from 'express';
import { PostgresPropertyRepository } from './infrastructure/persistence/postgres-property.repository.js';
import { CreatePropertyUseCase } from './application/commands/create-property.use-case.js';
import { UpdatePropertyStatusUseCase } from './application/commands/update-property-status.use-case.js';
import { ListPropertiesQuery } from './application/queries/list-properties.query.js';
import { GetPropertyDetailsQuery } from './application/queries/get-property-details.query.js';
import { PropertyController } from './presentation/http/property.controller.js';
import { createPropertyRouter } from './presentation/http/property.routes.js';
import { container } from '../../bootstrap/container.js';
import { PropertyDto } from '@monolith/contracts';

export interface IPropertyModulePublicApi {
  getPropertyById(id: string): Promise<PropertyDto | null>;
  verifyOwner(propertyId: string, ownerId: string): Promise<boolean>;
  getEmergencyFloatLimit(propertyId: string): Promise<number>;
}

export class PropertyModule {
  public static init(): { router: Router; publicApi: IPropertyModulePublicApi } {
    const repository = new PostgresPropertyRepository();
    const createPropertyUseCase = new CreatePropertyUseCase(repository);
    const updatePropertyStatusUseCase = new UpdatePropertyStatusUseCase(repository);
    const listPropertiesQuery = new ListPropertiesQuery(repository);
    const getPropertyDetailsQuery = new GetPropertyDetailsQuery(repository);

    const controller = new PropertyController(
      createPropertyUseCase,
      updatePropertyStatusUseCase,
      listPropertiesQuery,
      getPropertyDetailsQuery
    );
    const router = createPropertyRouter(controller);

    const publicApi: IPropertyModulePublicApi = {
      getPropertyById: async (id: string) => {
        const property = await repository.findById(id);
        if (!property) return null;
        return {
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
        };
      },
      verifyOwner: async (propertyId: string, ownerId: string) => {
        const property = await repository.findById(propertyId);
        return property ? property.ownerId === ownerId : false;
      },
      getEmergencyFloatLimit: async (propertyId: string) => {
        const property = await repository.findById(propertyId);
        return property ? property.emergencyFloatLimit : 0;
      }
    };

    container.register('IPropertyModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
