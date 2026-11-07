export { InventoryModule, type IInventoryModulePublicApi } from './inventory.module.js';
export {
  InventoryItem,
  type InventoryProps,
  InsufficientStockError,
  ConcurrencyError
} from './domain/entities/inventory.entity.js';
export { type IInventoryRepository } from './domain/repositories/inventory-repository.interface.js';
export { PostgresInventoryRepository } from './infrastructure/persistence/postgres-inventory.repository.js';
export {
  ListInventoryQuery,
  GetInventoryItemQuery,
  CreateInventoryItemUseCase,
  ReserveStockUseCase,
  ReleaseStockUseCase,
  CommitStockUseCase,
  type ListInventoryInput,
  type GetInventoryItemInput
} from './application/use-cases/inventory.use-cases.js';
export { InventoryController } from './presentation/http/inventory.controller.js';
export { createInventoryRouter } from './presentation/http/inventory.routes.js';
