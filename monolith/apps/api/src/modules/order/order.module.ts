import { Router } from 'express';
import { PostgresOrderRepository } from './infrastructure/persistence/postgres-order.repository.js';
import { CreateOrderUseCase, CancelOrderUseCase, GetOrderByIdQuery, ListMyOrdersQuery } from './application/commands/order.commands.js';
import { OrderController } from './presentation/http/order.controller.js';
import { createOrderRouter } from './presentation/http/order.routes.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { OrderDto } from '@monolith/contracts';

export interface IOrderModulePublicApi {
  getOrder(orderId: string): Promise<OrderDto | null>;
  markOrderPaid(orderId: string): Promise<boolean>;
}

export class OrderModule {
  public static init(): { router: Router; publicApi: IOrderModulePublicApi } {
    const repository = new PostgresOrderRepository();
    const createOrderUseCase = new CreateOrderUseCase(repository, eventBus);
    const cancelOrderUseCase = new CancelOrderUseCase(repository, eventBus);
    const getOrderByIdQuery = new GetOrderByIdQuery(repository);
    const listMyOrdersQuery = new ListMyOrdersQuery(repository);

    const controller = new OrderController(createOrderUseCase, cancelOrderUseCase, getOrderByIdQuery, listMyOrdersQuery);
    const router = createOrderRouter(controller);

    // Asynchronous integration event consumer: Listen for successful transaction payments
    eventBus.subscribe('transactions.completed', async (event: any) => {
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
      getOrder: async (orderId: string) => {
        const order = await repository.findById(orderId);
        if (!order) return null;
        return {
          id: order.id,
          userId: order.userId,
          status: order.status,
          items: order.items,
          totalAmount: order.totalAmount,
          currency: order.currency,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString()
        };
      },
      markOrderPaid: async (orderId: string) => {
        const order = await repository.findById(orderId);
        if (!order) return false;
        order.markPaid();
        await repository.update(order);
        return true;
      }
    };

    container.register('IOrderModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
