import { Router } from 'express';
import { PostgresInventoryRepository } from './infrastructure/persistence/postgres-inventory.repository.js';
import {
  ListInventoryQuery,
  GetInventoryItemQuery,
  CreateInventoryItemUseCase,
  ReserveStockUseCase,
  ReleaseStockUseCase,
  CommitStockUseCase
} from './application/use-cases/inventory.use-cases.js';
import { InventoryController } from './presentation/http/inventory.controller.js';
import { createInventoryRouter } from './presentation/http/inventory.routes.js';
import { container } from '../../bootstrap/container.js';
import { InventoryItemDto } from '@monolith/contracts';
import { IInventoryRepository } from './domain/repositories/inventory-repository.interface.js';

export interface IInventoryModulePublicApi {
  getStock(productId: string, tenantId?: string): Promise<InventoryItemDto | null>;
  reserve(productId: string, quantity: number, orderId: string, tenantId?: string, expectedVersion?: number): Promise<boolean>;
  release(productId: string, quantity: number, orderId: string, tenantId?: string): Promise<boolean>;
  commit(productId: string, quantity: number, orderId: string, tenantId?: string): Promise<boolean>;
  getRepository(): IInventoryRepository;
}

export class InventoryModule {
  public static init(customRepository?: IInventoryRepository): {
    router: Router;
    publicApi: IInventoryModulePublicApi;
    repository: IInventoryRepository;
  } {
    const repository = customRepository || new PostgresInventoryRepository();
    const listQuery = new ListInventoryQuery(repository);
    const getQuery = new GetInventoryItemQuery(repository);
    const createUseCase = new CreateInventoryItemUseCase(repository);
    const reserveUseCase = new ReserveStockUseCase(repository);
    const releaseUseCase = new ReleaseStockUseCase(repository);
    const commitUseCase = new CommitStockUseCase(repository);

    const controller = new InventoryController(
      listQuery,
      getQuery,
      createUseCase,
      reserveUseCase,
      releaseUseCase,
      commitUseCase
    );

    const router = createInventoryRouter(controller);

    const publicApi: IInventoryModulePublicApi = {
      getStock: async (productId: string, tenantId?: string) => {
        const item = await repository.findByProductId(productId, tenantId);
        if (!item) return null;
        return {
          productId: item.productId,
          tenantId: item.tenantId,
          sku: item.sku,
          name: item.name,
          category: item.category,
          availableQuantity: item.availableQuantity,
          reservedQuantity: item.reservedQuantity,
          totalQuantity: item.totalQuantity,
          version: item.version,
          updatedAt: item.updatedAt.toISOString()
        };
      },
      reserve: async (productId: string, quantity: number, orderId: string, tenantId?: string, expectedVersion?: number) => {
        const res = await reserveUseCase.execute({ productId, quantity, orderId, tenantId, expectedVersion });
        return res.isSuccess;
      },
      release: async (productId: string, quantity: number, orderId: string, tenantId?: string) => {
        const res = await releaseUseCase.execute({ productId, quantity, orderId, tenantId });
        return res.isSuccess;
      },
      commit: async (productId: string, quantity: number, orderId: string, tenantId?: string) => {
        const res = await commitUseCase.execute({ productId, quantity, orderId, tenantId });
        return res.isSuccess;
      },
      getRepository: () => repository
    };

    container.register('IInventoryModulePublicApi', publicApi);
    container.register('IInventoryRepository', repository);

    return { router, publicApi, repository };
  }
}
