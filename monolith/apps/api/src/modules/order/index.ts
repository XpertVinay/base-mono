export { OrderModule, type IOrderModulePublicApi } from './order.module.js';
export {
  Order,
  type OrderProps,
  type OrderItemProps,
  InvalidStateTransitionError
} from './domain/entities/order.entity.js';
export { type IOrderRepository } from './domain/repositories/order-repository.interface.js';
export { PostgresOrderRepository } from './infrastructure/persistence/postgres-order.repository.js';
export {
  CreateOrderUseCase,
  CancelOrderUseCase,
  FulfillOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery,
  ListTenantOrdersQuery,
  type CreateOrderInput,
  type IInventoryReservationService
} from './application/commands/order.commands.js';
export { OrderController } from './presentation/http/order.controller.js';
export { createOrderRouter } from './presentation/http/order.routes.js';
