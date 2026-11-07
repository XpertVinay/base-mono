import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import { CreateOrderRequestDto, OrderDto } from '@monolith/contracts';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError
} from '../../../../shared/presentation/error-handler.middleware.js';

export interface IInventoryReservationService {
  reserve(productId: string, quantity: number, orderId: string, tenantId?: string): Promise<boolean>;
  release(productId: string, quantity: number, orderId: string, tenantId?: string): Promise<boolean>;
  commit(productId: string, quantity: number, orderId: string, tenantId?: string): Promise<boolean>;
}

export interface CreateOrderInput extends CreateOrderRequestDto {
  userId: string;
  tenantId?: string;
}

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, OrderDto> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus,
    private readonly inventoryService?: IInventoryReservationService
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<OrderDto, Error>> {
    try {
      const tenantId = input.tenantId || 'default-tenant';
      if (!input.userId) {
        return Result.fail(new BadRequestError('User ID is required'));
      }
      if (!input.items || input.items.length === 0) {
        return Result.fail(new BadRequestError('Order must contain at least one item'));
      }

      const order = Order.create(input.userId, input.items, input.currency, undefined, tenantId);

      // Coordinate inventory reservation if inventory service is connected
      if (this.inventoryService) {
        const reservedItems: { productId: string; quantity: number }[] = [];
        for (const item of order.items) {
          const reserved = await this.inventoryService.reserve(item.productId, item.quantity, order.id, tenantId);
          if (!reserved) {
            // Rollback already held reservations for this order
            for (const r of reservedItems) {
              await this.inventoryService.release(r.productId, r.quantity, order.id, tenantId);
            }
            return Result.fail(
              new ConflictError(`Insufficient inventory to reserve product '${item.productId}' for order`)
            );
          }
          reservedItems.push({ productId: item.productId, quantity: item.quantity });
        }
        order.markReserved();
      }

      await this.orderRepository.save(order);

      // Dispatch domain events
      for (const event of order.domainEvents) {
        await this.eventBus.publish({
          id: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          version: event.version
        });
      }
      order.clearEvents();

      return Result.ok(this.mapToDto(order));
    } catch (err: any) {
      return Result.fail(err);
    }
  }

  private mapToDto(order: Order): OrderDto {
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
  }
}

export class CancelOrderUseCase implements IUseCase<{ orderId: string; userId: string; role?: string; tenantId: string; reason?: string }, OrderDto> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus,
    private readonly inventoryService?: IInventoryReservationService
  ) {}

  async execute({
    orderId,
    userId,
    role,
    tenantId,
    reason
  }: {
    orderId: string;
    userId: string;
    role?: string;
    tenantId: string;
    reason?: string;
  }): Promise<Result<OrderDto, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId, tenantId);
      if (!order) {
        return Result.fail(new NotFoundError(`Order with id '${orderId}'`));
      }

      // Resource-level authorization: Only the owner or an ADMIN/ORG_ADMIN can cancel
      if (order.userId !== userId && role !== 'ADMIN' && role !== 'ORGANIZATION_ADMIN' && role !== 'ORGANIZATION_OWNER') {
        return Result.fail(new ForbiddenError('You do not own this order'));
      }

      order.cancel(reason || 'User requested cancellation');

      // Release reserved inventory if inventory service is connected
      if (this.inventoryService) {
        for (const item of order.items) {
          await this.inventoryService.release(item.productId, item.quantity, order.id, tenantId);
        }
      }

      await this.orderRepository.update(order);

      for (const event of order.domainEvents) {
        await this.eventBus.publish({
          id: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          version: event.version
        });
      }
      order.clearEvents();

      return Result.ok({
        id: order.id,
        tenantId: order.tenantId,
        userId: order.userId,
        status: order.status,
        items: order.items,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class FulfillOrderUseCase implements IUseCase<{ orderId: string; tenantId: string }, OrderDto> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus,
    private readonly inventoryService?: IInventoryReservationService
  ) {}

  async execute({ orderId, tenantId }: { orderId: string; tenantId: string }): Promise<Result<OrderDto, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId, tenantId);
      if (!order) {
        return Result.fail(new NotFoundError(`Order with id '${orderId}'`));
      }

      order.fulfill();

      // Commit reserved inventory permanently
      if (this.inventoryService) {
        for (const item of order.items) {
          await this.inventoryService.commit(item.productId, item.quantity, order.id, tenantId);
        }
      }

      await this.orderRepository.update(order);

      for (const event of order.domainEvents) {
        await this.eventBus.publish({
          id: event.id,
          eventName: event.eventName,
          aggregateId: event.aggregateId,
          occurredAt: event.occurredAt.toISOString(),
          payload: event.payload,
          version: event.version
        });
      }
      order.clearEvents();

      return Result.ok({
        id: order.id,
        tenantId: order.tenantId,
        userId: order.userId,
        status: order.status,
        items: order.items,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetOrderByIdQuery implements IQuery<{ orderId: string; userId: string; role?: string; tenantId: string }, OrderDto> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute({
    orderId,
    userId,
    role,
    tenantId
  }: {
    orderId: string;
    userId: string;
    role?: string;
    tenantId: string;
  }): Promise<Result<OrderDto, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId, tenantId);
      if (!order) {
        return Result.fail(new NotFoundError(`Order with id '${orderId}'`));
      }

      // Resource-level authorization: Only the owner or an ADMIN can view
      if (order.userId !== userId && role !== 'ADMIN' && role !== 'ORGANIZATION_ADMIN' && role !== 'ORGANIZATION_OWNER') {
        return Result.fail(new ForbiddenError('You do not own this order'));
      }

      return Result.ok({
        id: order.id,
        tenantId: order.tenantId,
        userId: order.userId,
        status: order.status,
        items: order.items,
        totalAmount: order.totalAmount,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListMyOrdersQuery implements IQuery<{ userId: string; tenantId?: string }, OrderDto[]> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute({ userId, tenantId }: { userId: string; tenantId?: string }): Promise<Result<OrderDto[], Error>> {
    try {
      const orders = await this.orderRepository.findByUserId(userId, tenantId);
      return Result.ok(
        orders.map(o => ({
          id: o.id,
          tenantId: o.tenantId,
          userId: o.userId,
          status: o.status,
          items: o.items,
          totalAmount: o.totalAmount,
          currency: o.currency,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString()
        }))
      );
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListTenantOrdersQuery implements IQuery<{ tenantId: string }, OrderDto[]> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute({ tenantId }: { tenantId: string }): Promise<Result<OrderDto[], Error>> {
    try {
      const orders = await this.orderRepository.findAll(tenantId);
      return Result.ok(
        orders.map(o => ({
          id: o.id,
          tenantId: o.tenantId,
          userId: o.userId,
          status: o.status,
          items: o.items,
          totalAmount: o.totalAmount,
          currency: o.currency,
          createdAt: o.createdAt.toISOString(),
          updatedAt: o.updatedAt.toISOString()
        }))
      );
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
