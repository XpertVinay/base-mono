import { Order } from '../entities/order.entity.js';

export interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
  update(order: Order): Promise<void>;
}
