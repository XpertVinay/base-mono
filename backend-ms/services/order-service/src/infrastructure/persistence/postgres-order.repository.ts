import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order, OrderItem, OrderStatus } from '../../domain/entities/order.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresOrderRepository implements IOrderRepository {
  async findById(id: string): Promise<Order | null> {
    const orderRes = await dbPool.query(
      'SELECT id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE id = $1',
      [id]
    );
    if (orderRes.rows.length === 0) return null;

    const itemsRes = await dbPool.query(
      'SELECT id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = $1',
      [id]
    );

    return this.mapToDomain(orderRes.rows[0], itemsRes.rows);
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const ordersRes = await dbPool.query(
      'SELECT id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    if (ordersRes.rows.length === 0) return [];

    // Performance optimization: Batch fetch items in 1 query instead of sequential N queries
    const orderIds = ordersRes.rows.map(r => r.id);
    const itemsRes = await dbPool.query(
      'SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = ANY($1)',
      [orderIds]
    );

    const itemsByOrderId = new Map<string, any[]>();
    for (const item of itemsRes.rows) {
      const list = itemsByOrderId.get(item.order_id) || [];
      list.push(item);
      itemsByOrderId.set(item.order_id, list);
    }

    return ordersRes.rows.map(row => this.mapToDomain(row, itemsByOrderId.get(row.id) || []));
  }

  async save(order: Order): Promise<void> {
    const pool = dbPool.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO orders.orders (id, user_id, status, total_amount, currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, order.userId, order.status, order.totalAmount, order.currency, order.createdAt, order.updatedAt]
      );

      for (const item of order.items) {
        await client.query(
          `INSERT INTO orders.order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [item.id, order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(order: Order): Promise<void> {
    await dbPool.query(
      'UPDATE orders.orders SET status = $2, updated_at = $3 WHERE id = $1',
      [order.id, order.status, order.updatedAt]
    );
  }

  private mapToDomain(orderRow: any, itemRows: any[]): Order {
    const items: OrderItem[] = itemRows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      quantity: parseInt(r.quantity, 10),
      unitPrice: parseFloat(r.unit_price),
      totalPrice: parseFloat(r.total_price)
    }));

    return Order.reconstitute(
      {
        userId: orderRow.user_id,
        status: orderRow.status as OrderStatus,
        items,
        totalAmount: parseFloat(orderRow.total_amount),
        currency: orderRow.currency,
        createdAt: new Date(orderRow.created_at),
        updatedAt: new Date(orderRow.updated_at)
      },
      orderRow.id
    );
  }
}
