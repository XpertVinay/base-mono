import { IOrderRepository, ListOrdersOptions } from '../../domain/repositories/order-repository.interface.js';
import { OrderStatus } from '../../domain/entities/order.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface ListAllOrdersDTO extends ListOrdersOptions {
  tenantId?: string;
}

export interface GetOrderByIdDTO {
  id: string;
  tenantId?: string;
}

export interface UpdateOrderStatusDTO {
  orderId: string;
  status: OrderStatus;
  tenantId?: string;
  reason?: string;
}

export interface UpdateOrderDTO {
  orderId: string;
  totalAmount?: number;
  currency?: string;
  tenantId?: string;
}

export interface DeleteOrderDTO {
  orderId: string;
  tenantId?: string;
}

export class ListAllOrdersQuery {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(dto: ListAllOrdersDTO): Promise<Result<{ orders: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.findAll(dto.tenantId, {
      page,
      limit,
      status: dto.status,
      userId: dto.userId,
      search: dto.search
    });

    const mapped = result.orders.map(o => ({
      id: o.id,
      tenantId: o.tenantId,
      userId: o.userId,
      status: o.status,
      items: o.items,
      totalAmount: o.totalAmount,
      currency: o.currency,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    }));

    return Result.ok({
      orders: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class GetBackofficeOrderByIdQuery {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(dto: GetOrderByIdDTO): Promise<Result<any>> {
    const order = await this.repo.findById(dto.id, dto.tenantId);
    if (!order) {
      return Result.fail('Order not found');
    }
    return Result.ok({
      id: order.id,
      tenantId: order.tenantId,
      userId: order.userId,
      status: order.status,
      items: order.items,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    });
  }
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(dto: UpdateOrderStatusDTO): Promise<Result<any>> {
    const order = await this.repo.findById(dto.orderId, dto.tenantId);
    if (!order) {
      return Result.fail('Order not found');
    }

    order.updateStatus(dto.status);
    await this.repo.update(order);

    return Result.ok({
      id: order.id,
      status: order.status,
      updatedAt: order.updatedAt
    });
  }
}

export class UpdateOrderUseCase {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(dto: UpdateOrderDTO): Promise<Result<any>> {
    const order = await this.repo.findById(dto.orderId, dto.tenantId);
    if (!order) {
      return Result.fail('Order not found');
    }

    order.updateDetails({
      totalAmount: dto.totalAmount,
      currency: dto.currency
    });
    await this.repo.update(order);

    return Result.ok({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      updatedAt: order.updatedAt
    });
  }
}

export class DeleteOrderUseCase {
  constructor(private readonly repo: IOrderRepository) {}

  async execute(dto: DeleteOrderDTO): Promise<Result<{ orderId: string; deleted: boolean }>> {
    const order = await this.repo.findById(dto.orderId, dto.tenantId);
    if (!order) {
      return Result.fail('Order not found');
    }

    const deleted = await this.repo.delete(dto.orderId, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete order');
    }

    return Result.ok({ orderId: dto.orderId, deleted: true });
  }
}

