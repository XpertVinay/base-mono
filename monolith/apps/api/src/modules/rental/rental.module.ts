import { Router } from 'express';
import { PostgresRentalRepository } from './infrastructure/persistence/postgres-rental.repository.js';
import { CreateListingUseCase } from './application/commands/create-listing.use-case.js';
import { CreateLeadUseCase } from './application/commands/create-lead.use-case.js';
import { UpdateLeadStatusUseCase } from './application/commands/update-lead-status.use-case.js';
import { ListListingsQuery } from './application/queries/list-listings.query.js';
import { ListLeadsQuery } from './application/queries/list-leads.query.js';
import { RentalController } from './presentation/http/rental.controller.js';
import { createRentalRouter } from './presentation/http/rental.routes.js';
import { container } from '../../bootstrap/container.js';
import { RentalListingDto } from '@monolith/contracts';

export interface IRentalModulePublicApi {
  getListingForProperty(propertyId: string): Promise<RentalListingDto | null>;
}

export class RentalModule {
  public static init(): { router: Router; publicApi: IRentalModulePublicApi } {
    const repository = new PostgresRentalRepository();
    const createListingUseCase = new CreateListingUseCase(repository);
    const createLeadUseCase = new CreateLeadUseCase(repository);
    const updateLeadStatusUseCase = new UpdateLeadStatusUseCase(repository);
    const listListingsQuery = new ListListingsQuery(repository);
    const listLeadsQuery = new ListLeadsQuery(repository);

    const controller = new RentalController(
      createListingUseCase,
      createLeadUseCase,
      updateLeadStatusUseCase,
      listListingsQuery,
      listLeadsQuery
    );
    const router = createRentalRouter(controller);

    const publicApi: IRentalModulePublicApi = {
      getListingForProperty: async (propertyId: string) => {
        const listing = await repository.findListingByPropertyId(propertyId);
        if (!listing) return null;
        return {
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
        };
      }
    };

    container.register('IRentalModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
