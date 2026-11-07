import { Router } from 'express';
import { ISearchRepository } from './domain/repositories/search-repository.interface.js';
import { PostgresSearchRepository } from './infrastructure/persistence/postgres-search.repository.js';
import {
  IndexDocumentUseCase,
  SearchQueryUseCase,
  GetSearchDocumentByIdQuery,
  DeleteSearchDocumentUseCase
} from './application/use-cases/search.use-cases.js';
import { SearchController } from './presentation/http/search.controller.js';
import { createSearchRouter } from './presentation/http/search.routes.js';
import { eventBus, IEventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { SearchResultItemDto, IndexDocumentRequestDto } from '@monolith/contracts';

export interface ISearchModulePublicApi {
  search(query: string, type?: string, tenantId?: string): Promise<SearchResultItemDto[]>;
  index(document: IndexDocumentRequestDto): Promise<void>;
  getById(id: string, tenantId?: string): Promise<SearchResultItemDto | null>;
}

export class SearchModule {
  public static init(
    customRepository?: ISearchRepository,
    customEventBus?: IEventBus
  ): {
    router: Router;
    publicApi: ISearchModulePublicApi;
    repository: ISearchRepository;
  } {
    const repository = customRepository || new PostgresSearchRepository();
    const effectiveEventBus = customEventBus || eventBus;

    const indexUseCase = new IndexDocumentUseCase(repository);
    const searchUseCase = new SearchQueryUseCase(repository);
    const getByIdQuery = new GetSearchDocumentByIdQuery(repository);
    const deleteUseCase = new DeleteSearchDocumentUseCase(repository);

    const controller = new SearchController(
      searchUseCase,
      indexUseCase,
      getByIdQuery,
      deleteUseCase
    );
    const router = createSearchRouter(controller);

    // Event-driven projection: Index orders automatically with tenantId
    effectiveEventBus.subscribe('orders.order_created', async (event: any) => {
      const payload = event.payload as any;
      if (!payload?.orderId) return;

      logger.info('SearchModule projecting order to search index', { orderId: payload.orderId, tenantId: payload.tenantId });
      await indexUseCase.execute({
        id: payload.orderId,
        tenantId: payload.tenantId,
        type: 'ORDER',
        title: `Order #${payload.orderId.substring(0, 8)}`,
        description: `Order with ${payload.items?.length || 0} items totaling ${payload.currency || 'USD'} ${payload.totalAmount}`,
        metadata: { userId: payload.userId, totalAmount: payload.totalAmount, tenantId: payload.tenantId }
      });
    });

    // Event-driven projection: Index users automatically
    effectiveEventBus.subscribe('iam.user_registered', async (event: any) => {
      const payload = event.payload as any;
      if (!payload?.userId) return;

      logger.info('SearchModule projecting user to search index', { userId: payload.userId, tenantId: payload.tenantId });
      await indexUseCase.execute({
        id: payload.userId,
        tenantId: payload.tenantId,
        type: 'USER',
        title: payload.name || payload.email,
        description: `Member: ${payload.email} (Role: ${payload.role})`,
        metadata: { role: payload.role, email: payload.email, tenantId: payload.tenantId }
      });
    });

    const publicApi: ISearchModulePublicApi = {
      search: async (query, type, tenantId) => {
        const res = await searchUseCase.execute({ query, type, tenantId });
        return res.isSuccess ? res.getValue() : [];
      },
      index: async (document) => {
        const res = await indexUseCase.execute(document);
        if (res.isFailure) throw res.getError();
      },
      getById: async (id, tenantId) => {
        const res = await getByIdQuery.execute({ id, tenantId });
        return res.isSuccess ? res.getValue() : null;
      }
    };

    container.register('ISearchModulePublicApi', publicApi);
    return { router, publicApi, repository };
  }
}
