import { Order } from '../entities/order.entity.js';

export interface IOrderRepository {
  findById(id: string, tenantId?: string): Promise<Order | null>;
  findByUserId(userId: string, tenantId?: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
}
