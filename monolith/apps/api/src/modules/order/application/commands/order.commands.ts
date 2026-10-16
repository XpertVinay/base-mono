import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import { CreateOrderRequestDto, OrderDto } from '@monolith/contracts';
import { NotFoundError, ForbiddenError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface CreateOrderInput extends CreateOrderRequestDto {
  userId: string;
}

export class CreateOrderUseCase implements IUseCase<CreateOrderInput, OrderDto> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<OrderDto, Error>> {
    try {
      const order = Order.create(input.userId, input.items, input.currency);
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

export class CancelOrderUseCase implements IUseCase<{ orderId: string; userId: string; role: string }, OrderDto> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute({ orderId, userId, role }: { orderId: string; userId: string; role: string }): Promise<Result<OrderDto, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) return Result.fail(new NotFoundError(`Order with id '${orderId}'`));

      // Resource-level authorization: Only the owner or an ADMIN can cancel
      if (order.userId !== userId && role !== 'ADMIN') {
        return Result.fail(new ForbiddenError('You do not own this order'));
      }

      order.cancel('User requested cancellation');
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

export class GetOrderByIdQuery implements IQuery<{ orderId: string; userId: string; role: string }, OrderDto> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute({ orderId, userId, role }: { orderId: string; userId: string; role: string }): Promise<Result<OrderDto, Error>> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) return Result.fail(new NotFoundError(`Order with id '${orderId}'`));

      // Resource-level authorization
      if (order.userId !== userId && role !== 'ADMIN') {
        return Result.fail(new ForbiddenError('You do not own this order'));
      }

      return Result.ok({
        id: order.id,
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

export class ListMyOrdersQuery implements IQuery<{ userId: string }, OrderDto[]> {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute({ userId }: { userId: string }): Promise<Result<OrderDto[], Error>> {
    try {
      const orders = await this.orderRepository.findByUserId(userId);
      return Result.ok(orders.map(o => ({
        id: o.id,
        userId: o.userId,
        status: o.status,
        items: o.items,
        totalAmount: o.totalAmount,
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
