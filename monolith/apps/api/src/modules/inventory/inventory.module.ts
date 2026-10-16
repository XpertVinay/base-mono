import { Router } from 'express';
import { PostgresInventoryRepository } from './infrastructure/persistence/postgres-inventory.repository.js';
import { ListInventoryQuery, ReserveStockUseCase } from './application/use-cases/inventory.use-cases.js';
import { InventoryController } from './presentation/http/inventory.controller.js';
import { createInventoryRouter } from './presentation/http/inventory.routes.js';
import { container } from '../../bootstrap/container.js';
import { InventoryItemDto } from '@monolith/contracts';

export interface IInventoryModulePublicApi {
  getStock(productId: string): Promise<InventoryItemDto | null>;
  reserve(productId: string, quantity: number, orderId: string): Promise<boolean>;
}

export class InventoryModule {
  public static init(): { router: Router; publicApi: IInventoryModulePublicApi } {
    const repository = new PostgresInventoryRepository();
    const listQuery = new ListInventoryQuery(repository);
    const reserveUseCase = new ReserveStockUseCase(repository);

    const controller = new InventoryController(listQuery, reserveUseCase);
    const router = createInventoryRouter(controller);

    const publicApi: IInventoryModulePublicApi = {
      getStock: async (productId: string) => {
        const item = await repository.findByProductId(productId);
        if (!item) return null;
        return {
          productId: item.productId,
          sku: item.sku,
          availableQuantity: item.availableQuantity,
          reservedQuantity: item.reservedQuantity,
          totalQuantity: item.totalQuantity,
          updatedAt: item.updatedAt.toISOString()
        };
      },
      reserve: async (productId: string, quantity: number, orderId: string) => {
        const res = await reserveUseCase.execute({ productId, quantity, orderId });
        return res.isSuccess;
      }
    };

    container.register('IInventoryModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
