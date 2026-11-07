import { Router } from 'express';
import { PostgresOrderRepository } from './infrastructure/persistence/postgres-order.repository.js';
import {
  CreateOrderUseCase,
  CancelOrderUseCase,
  FulfillOrderUseCase,
  GetOrderByIdQuery,
  ListMyOrdersQuery,
  ListTenantOrdersQuery,
  IInventoryReservationService
} from './application/commands/order.commands.js';
import { OrderController } from './presentation/http/order.controller.js';
import { createOrderRouter } from './presentation/http/order.routes.js';
import { eventBus, IEventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { OrderDto } from '@monolith/contracts';
import { IOrderRepository } from './domain/repositories/order-repository.interface.js';

export interface IOrderModulePublicApi {
  getOrder(orderId: string, tenantId?: string): Promise<OrderDto | null>;
  markOrderPaid(orderId: string, tenantId?: string): Promise<boolean>;
  fulfillOrder(orderId: string, tenantId?: string): Promise<boolean>;
  cancelOrder(orderId: string, tenantId?: string, reason?: string): Promise<boolean>;
  getRepository(): IOrderRepository;
}

export class OrderModule {
  public static init(
    customRepository?: IOrderRepository,
    customInventoryService?: IInventoryReservationService,
    customEventBus?: IEventBus
  ): {
    router: Router;
    publicApi: IOrderModulePublicApi;
    repository: IOrderRepository;
  } {
    const repository = customRepository || new PostgresOrderRepository();
    const bus = customEventBus || eventBus;

    // Dynamically resolve inventory service from container if not explicitly passed
    let inventoryService = customInventoryService;
    if (!inventoryService) {
      try {
        const resolved = container.resolve<any>('IInventoryModulePublicApi');
        if (resolved && typeof resolved.reserve === 'function') {
          inventoryService = resolved;
        }
      } catch {
        // Inventory module not yet initialized in container
      }
    }

    const createOrderUseCase = new CreateOrderUseCase(repository, bus, inventoryService);
    const cancelOrderUseCase = new CancelOrderUseCase(repository, bus, inventoryService);
    const fulfillOrderUseCase = new FulfillOrderUseCase(repository, bus, inventoryService);
    const getOrderByIdQuery = new GetOrderByIdQuery(repository);
    const listMyOrdersQuery = new ListMyOrdersQuery(repository);
    const listTenantOrdersQuery = new ListTenantOrdersQuery(repository);

    const controller = new OrderController(
      createOrderUseCase,
      cancelOrderUseCase,
      fulfillOrderUseCase,
      getOrderByIdQuery,
      listMyOrdersQuery,
      listTenantOrdersQuery
    );
    const router = createOrderRouter(controller);

    // Asynchronous integration event consumer: Listen for successful transaction payments
    bus.subscribe('transactions.completed', async (event: any) => {
      const payload = event.payload as any;
      if (payload.status === 'SUCCESS' && payload.referenceId) {
        logger.info(`OrderModule received transaction completion for order ${payload.referenceId}`);
        const order = await repository.findById(payload.referenceId);
        if (order) {
          order.markPaid();
          await repository.update(order);
          logger.info(`Order ${order.id} status updated to PAID`);
        }
      }
    });

    const publicApi: IOrderModulePublicApi = {
      getOrder: async (orderId: string, tenantId?: string) => {
        const order = await repository.findById(orderId, tenantId);
        if (!order) return null;
        return {
          id: order.id,
          tenantId: order.tenantId,
          userId: order.userId,
          status: order.status,
          items: order.items,
          totalAmount: order.totalAmount,
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString()
        };
      },
      markOrderPaid: async (orderId: string, tenantId?: string) => {
        const order = await repository.findById(orderId, tenantId);
        if (!order) return false;
        order.markPaid();
        await repository.update(order);
        return true;
      },
      fulfillOrder: async (orderId: string, tenantId?: string) => {
        const res = await fulfillOrderUseCase.execute({
          orderId,
          tenantId: tenantId || 'default-tenant'
        });
        return res.isSuccess;
      },
      cancelOrder: async (orderId: string, tenantId?: string, reason?: string) => {
        const order = await repository.findById(orderId, tenantId);
        if (!order) return false;
        const res = await cancelOrderUseCase.execute({
          orderId,
          userId: order.userId,
          role: 'ADMIN',
          tenantId: order.tenantId,
          reason
        });
        return res.isSuccess;
      },
      getRepository: () => repository
    };

    container.register('IOrderModulePublicApi', publicApi);
    container.register('IOrderRepository', repository);

    return { router, publicApi, repository };
  }
}
