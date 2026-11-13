import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { InventoryGrpcClient } from '../../grpc/inventory-grpc.client.js';
import { OrderDto } from '../../shared/contracts/index.js';

export interface CreateOrderInput {
  userId: string;
  tenantId?: string;
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
      const tenantId = input.tenantId || 'default';

      // 1. Pre-check stock
      for (const item of input.items) {
        const available = await this.inventoryClient.checkStock(item.productId, item.quantity);
        if (!available) {
          return Result.fail(`Product '${item.productName}' is out of stock`);
        }
      }

      // 2. Persist order
      const order = Order.create(input.userId, input.items, input.currency || 'USD', undefined, tenantId);
      await this.repo.save(order);

      // 3. Atomically reserve stock for each item with compensation tracking
      const reservedItems: Array<{ productId: string; quantity: number }> = [];
      let reservationFailed = false;
      let failureReason = '';

      for (const item of input.items) {
        const reservedOk = await this.inventoryClient.reserveStock(item.productId, item.quantity, order.id);
        if (!reservedOk) {
          reservationFailed = true;
          failureReason = `Stock reservation failed for product '${item.productName}'`;
          break;
        }
        reservedItems.push({ productId: item.productId, quantity: item.quantity });
      }

      // 4. Saga Compensation if any item failed reservation
      if (reservationFailed) {
        order.cancel(failureReason);
        await this.repo.update(order);

        // Compensate / release previously reserved stock
        for (const item of reservedItems) {
          try {
            await this.inventoryClient.releaseStock(item.productId, item.quantity, order.id);
          } catch {
            // Logged inside client
          }
        }

        return Result.fail(failureReason);
      }

      // 5. Publish RabbitMQ Event
      await rabbitmq.publish('orders.order_created', {
        id: crypto.randomUUID(),
        eventName: 'orders.order_created',
        aggregateId: order.id,
        occurredAt: new Date().toISOString(),
        payload: {
          orderId: order.id,
          tenantId: order.tenantId,
          userId: order.userId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items
        },
        version: 1,
        tenantId: order.tenantId
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

export class CancelOrderUseCase implements UseCase<{ orderId: string; userId: string; role: string; tenantId?: string }, OrderDto> {
  constructor(
    private readonly repo: IOrderRepository,
    private readonly inventoryClient?: InventoryGrpcClient
  ) {}

  async execute(input: { orderId: string; userId: string; role: string; tenantId?: string }): Promise<Result<OrderDto>> {
    const order = await this.repo.findById(input.orderId, input.tenantId);
    if (!order) return Result.fail('Order not found');

    if (input.tenantId && order.tenantId !== input.tenantId && input.role !== 'ADMIN') {
      return Result.fail('Forbidden: Tenant mismatch');
    }

    if (order.userId !== input.userId && input.role !== 'ADMIN') {
      return Result.fail('Forbidden to cancel this order');
    }

    order.cancel();
    await this.repo.update(order);

    // Release reserved inventory upon cancellation
    if (this.inventoryClient) {
      for (const item of order.items) {
        try {
          await this.inventoryClient.releaseStock(item.productId, item.quantity, order.id);
        } catch {
          // Logged inside client
        }
      }
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

export class GetOrderByIdQuery implements UseCase<{ orderId: string; userId: string; role: string; tenantId?: string }, OrderDto> {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(input: { orderId: string; userId: string; role: string; tenantId?: string }): Promise<Result<OrderDto>> {
    const order = await this.repo.findById(input.orderId, input.tenantId);
    if (!order) return Result.fail('Order not found');

    if (input.tenantId && order.tenantId !== input.tenantId && input.role !== 'ADMIN') {
      return Result.fail('Forbidden: Tenant mismatch');
    }

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

export class ListMyOrdersQuery implements UseCase<{ userId: string; tenantId?: string }, OrderDto[]> {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(input: { userId: string; tenantId?: string }): Promise<Result<OrderDto[]>> {
    const orders = await this.repo.findByUserId(input.userId, input.tenantId);
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
