import { Router } from 'express';
import { PostgresSearchRepository } from './infrastructure/persistence/postgres-search.repository.js';
import { IndexDocumentUseCase, SearchQueryUseCase } from './application/use-cases/search.use-cases.js';
import { SearchController } from './presentation/http/search.controller.js';
import { createSearchRouter } from './presentation/http/search.routes.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { SearchResultItemDto } from '@monolith/contracts';

export interface ISearchModulePublicApi {
  search(query: string, type?: string): Promise<SearchResultItemDto[]>;
}

export class SearchModule {
  public static init(): { router: Router; publicApi: ISearchModulePublicApi } {
    const repository = new PostgresSearchRepository();
    const indexUseCase = new IndexDocumentUseCase(repository);
    const searchUseCase = new SearchQueryUseCase(repository);

    const controller = new SearchController(searchUseCase);
    const router = createSearchRouter(controller);

    // Event-driven projection: Index orders automatically
    eventBus.subscribe('orders.order_created', async (event: any) => {
      const payload = event.payload as any;
      logger.info('SearchModule projecting order to search index', { orderId: payload.orderId });
      await indexUseCase.execute({
        id: payload.orderId,
        type: 'ORDER',
        title: `Order #${payload.orderId.substring(0, 8)}`,
        description: `Order with ${payload.items?.length || 0} items totaling ${payload.currency} ${payload.totalAmount}`,
        metadata: { userId: payload.userId, totalAmount: payload.totalAmount }
      });
    });

    // Event-driven projection: Index users automatically
    eventBus.subscribe('iam.user_registered', async (event: any) => {
      const payload = event.payload as any;
      logger.info('SearchModule projecting user to search index', { userId: payload.userId });
      await indexUseCase.execute({
        id: payload.userId,
        type: 'USER',
        title: payload.name,
        description: `Member: ${payload.email} (Role: ${payload.role})`,
        metadata: { role: payload.role, email: payload.email }
      });
    });

    const publicApi: ISearchModulePublicApi = {
      search: async (query, type) => {
        const res = await searchUseCase.execute({ query, type });
        return res.isSuccess ? res.getValue() : [];
      }
    };

    container.register('ISearchModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
