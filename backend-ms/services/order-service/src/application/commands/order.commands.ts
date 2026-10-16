import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { InventoryGrpcClient } from '../../grpc/inventory-grpc.client.js';
import { OrderDto } from '../../shared/contracts/index.js';

export interface CreateOrderInput {
  userId: string;
  items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>;
  currency?: string;
}

export class CreateOrderUseCase implements UseCase<CreateOrderInput, OrderDto> {
  constructor(
    private readonly repo: IOrderRepository,
    private readonly inventoryClient: InventoryGrpcClient
  ) {}

  async execute(input: CreateOrderInput): Promise<Result<OrderDto>> {
    try {
      // Synchronous stock reservation check via gRPC
      for (const item of input.items) {
        const available = await this.inventoryClient.checkStock(item.productId, item.quantity);
        if (!available) {
          return Result.fail(`Product '${item.productName}' is out of stock`);
        }
      }

      const order = Order.create(input.userId, input.items, input.currency || 'USD');
      await this.repo.save(order);

      // Reserve stock
      for (const item of input.items) {
        await this.inventoryClient.reserveStock(item.productId, item.quantity, order.id);
      }

      // Publish RabbitMQ Event
      await rabbitmq.publish('orders.order_created', {
        id: crypto.randomUUID(),
        eventName: 'orders.order_created',
        aggregateId: order.id,
        occurredAt: new Date().toISOString(),
        payload: {
          orderId: order.id,
          userId: order.userId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items
        },
        version: 1
      });

      return Result.ok(this.mapDto(order));
    } catch (err: any) {
      return Result.fail(err.message || 'Failed to create order');
    }
  }

  private mapDto(order: Order): OrderDto {
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

export class CancelOrderUseCase implements UseCase<{ orderId: string; userId: string; role: string }, OrderDto> {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(input: { orderId: string; userId: string; role: string }): Promise<Result<OrderDto>> {
    const order = await this.repo.findById(input.orderId);
    if (!order) return Result.fail('Order not found');

    if (order.userId !== input.userId && input.role !== 'ADMIN') {
      return Result.fail('Forbidden to cancel this order');
    }

    order.cancel();
    await this.repo.update(order);

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
  }
}

export class GetOrderByIdQuery implements UseCase<{ orderId: string; userId: string; role: string }, OrderDto> {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(input: { orderId: string; userId: string; role: string }): Promise<Result<OrderDto>> {
    const order = await this.repo.findById(input.orderId);
    if (!order) return Result.fail('Order not found');

    if (order.userId !== input.userId && input.role !== 'ADMIN') {
      return Result.fail('Forbidden: You do not own this order');
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
  }
}

export class ListMyOrdersQuery implements UseCase<{ userId: string }, OrderDto[]> {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(input: { userId: string }): Promise<Result<OrderDto[]>> {
    const orders = await this.repo.findByUserId(input.userId);
    return Result.ok(
      orders.map(o => ({
        id: o.id,
        userId: o.userId,
        status: o.status,
        items: o.items,
        totalAmount: o.totalAmount,
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString()
      }))
    );
  }
}
