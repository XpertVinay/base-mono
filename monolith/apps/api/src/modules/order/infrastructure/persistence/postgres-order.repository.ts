import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresOrderRepository implements IOrderRepository {
  private fallbackStore: Map<string, Order> = new Map();

  async findById(id: string): Promise<Order | null> {
    try {
      const orderRes = await dbPool.query(
        'SELECT id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE id = $1',
        [id]
      );
      if (orderRes.rows.length === 0) return this.fallbackStore.get(id) || null;

      const itemsRes = await dbPool.query(
        'SELECT id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = $1',
        [id]
      );

      return this.mapToDomain(orderRes.rows[0], itemsRes.rows);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByUserId(userId: string): Promise<Order[]> {
    try {
      const orderRes = await dbPool.query(
        'SELECT id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      if (orderRes.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(o => o.userId === userId);
      }

      const orders: Order[] = [];
      for (const row of orderRes.rows) {
        const itemsRes = await dbPool.query(
          'SELECT id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = $1',
          [row.id]
        );
        orders.push(this.mapToDomain(row, itemsRes.rows));
      }
      return orders;
    } catch {
      return Array.from(this.fallbackStore.values()).filter(o => o.userId === userId);
    }
  }

  async save(order: Order): Promise<void> {
    this.fallbackStore.set(order.id, order);
    try {
      await dbPool.query(
        `INSERT INTO orders.orders (id, user_id, status, total_amount, currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at`,
        [order.id, order.userId, order.status, order.totalAmount, order.currency, order.createdAt, order.updatedAt]
      );

      for (const item of order.items) {
        await dbPool.query(
          `INSERT INTO orders.order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice]
        );
      }
    } catch (err) {
      logger.warn('Failed to persist order in PostgreSQL, saved in fallback store', { id: order.id });
    }
  }

  async update(order: Order): Promise<void> {
    await this.save(order);
  }

  private mapToDomain(orderRow: any, itemRows: any[]): Order {
    return Order.reconstitute(orderRow.id, {
      userId: orderRow.user_id,
      status: orderRow.status,
      totalAmount: Number(orderRow.total_amount),
      currency: orderRow.currency,
      items: itemRows.map(i => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price),
        totalPrice: Number(i.total_price)
      })),
      createdAt: new Date(orderRow.created_at),
      updatedAt: new Date(orderRow.updated_at)
    });
  }
}
