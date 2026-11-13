import { Order } from '../entities/order.entity.js';

export interface ListOrdersOptions {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
  search?: string;
}

export interface IOrderRepository {
  findById(id: string, tenantId?: string): Promise<Order | null>;
  findByUserId(userId: string, tenantId?: string): Promise<Order[]>;
  findAll(tenantId?: string, options?: ListOrdersOptions): Promise<{ orders: Order[]; total: number }>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
