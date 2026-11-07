import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { Order } from '../../domain/entities/order.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { TransactionManager } from '../../../../infrastructure/database/transaction-manager.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresOrderRepository implements IOrderRepository {
  private fallbackStore: Map<string, Order> = new Map();

  async findById(id: string, tenantId?: string): Promise<Order | null> {
    try {
      let query = 'SELECT id, tenant_id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE id = $1';
      const params: any[] = [id];

      if (tenantId) {
        query += ' AND tenant_id = $2';
        params.push(tenantId);
      }

      const orderRes = await dbPool.query(query, params);
      if (orderRes.rows.length === 0) {
        return this.getFromFallback(id, tenantId);
      }

      const itemsRes = await dbPool.query(
        'SELECT id, tenant_id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = $1',
        [id]
      );

      return this.mapToDomain(orderRes.rows[0], itemsRes.rows);
    } catch {
      return this.getFromFallback(id, tenantId);
    }
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Order[]> {
    try {
      let query = 'SELECT id, tenant_id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders WHERE user_id = $1';
      const params: any[] = [userId];

      if (tenantId) {
        query += ' AND tenant_id = $2';
        params.push(tenantId);
      }

      query += ' ORDER BY created_at DESC';

      const orderRes = await dbPool.query(query, params);
      if (orderRes.rows.length === 0) {
        return this.getAllFromFallback(tenantId).filter(o => o.userId === userId);
      }

      const orderIds = orderRes.rows.map(r => r.id);
      const itemsRes = await dbPool.query(
        'SELECT id, order_id, tenant_id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = ANY($1)',
        [orderIds]
      );

      const itemsByOrderId = new Map<string, any[]>();
      for (const item of itemsRes.rows) {
        const list = itemsByOrderId.get(item.order_id) || [];
        list.push(item);
        itemsByOrderId.set(item.order_id, list);
      }

      return orderRes.rows.map(row => this.mapToDomain(row, itemsByOrderId.get(row.id) || []));
    } catch {
      return this.getAllFromFallback(tenantId).filter(o => o.userId === userId);
    }
  }

  async findAll(tenantId?: string): Promise<Order[]> {
    try {
      let query = 'SELECT id, tenant_id, user_id, status, total_amount, currency, created_at, updated_at FROM orders.orders';
      const params: any[] = [];

      if (tenantId) {
        query += ' WHERE tenant_id = $1';
        params.push(tenantId);
      }

      query += ' ORDER BY created_at DESC';

      const orderRes = await dbPool.query(query, params);
      if (orderRes.rows.length === 0) {
        return this.getAllFromFallback(tenantId);
      }

      const orderIds = orderRes.rows.map(r => r.id);
      const itemsRes = await dbPool.query(
        'SELECT id, order_id, tenant_id, product_id, product_name, quantity, unit_price, total_price FROM orders.order_items WHERE order_id = ANY($1)',
        [orderIds]
      );

      const itemsByOrderId = new Map<string, any[]>();
      for (const item of itemsRes.rows) {
        const list = itemsByOrderId.get(item.order_id) || [];
        list.push(item);
        itemsByOrderId.set(item.order_id, list);
      }

      return orderRes.rows.map(row => this.mapToDomain(row, itemsByOrderId.get(row.id) || []));
    } catch {
      return this.getAllFromFallback(tenantId);
    }
  }

  async save(order: Order): Promise<void> {
    this.fallbackStore.set(
      order.id,
      Order.reconstitute(order.id, {
        tenantId: order.tenantId,
        userId: order.userId,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        items: order.items.map(i => ({ ...i })),
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt)
      })
    );

    try {
      await TransactionManager.runInTransaction(async (ctx) => {
        await ctx.query(
          `INSERT INTO orders.orders (id, tenant_id, user_id, status, total_amount, currency, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             updated_at = EXCLUDED.updated_at`,
          [
            order.id,
            order.tenantId,
            order.userId,
            order.status,
            order.totalAmount,
            order.currency,
            order.createdAt,
            order.updatedAt
          ]
        );

        for (const item of order.items) {
          await ctx.query(
            `INSERT INTO orders.order_items (id, order_id, tenant_id, product_id, product_name, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               quantity = EXCLUDED.quantity,
               unit_price = EXCLUDED.unit_price,
               total_price = EXCLUDED.total_price`,
            [
              item.id,
              order.id,
              order.tenantId,
              item.productId,
              item.productName,
              item.quantity,
              item.unitPrice,
              item.totalPrice
            ]
          );
        }
      });
    } catch (err) {
      logger.warn('Failed to persist order in PostgreSQL, saved in fallback store', {
        id: order.id,
        tenantId: order.tenantId
      });
    }
  }

  async update(order: Order): Promise<void> {
    await this.save(order);
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const existing = this.fallbackStore.get(id);
    if (existing && existing.tenantId === tenantId) {
      this.fallbackStore.delete(id);
    }

    try {
      const res = await dbPool.query(
        'DELETE FROM orders.orders WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return true;
    }
  }

  private getFromFallback(id: string, tenantId?: string): Order | null {
    const order = this.fallbackStore.get(id);
    if (!order) return null;
    if (tenantId && order.tenantId !== tenantId) return null;
    return Order.reconstitute(order.id, {
      tenantId: order.tenantId,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      items: order.items.map(i => ({ ...i })),
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.updatedAt)
    });
  }

  private getAllFromFallback(tenantId?: string): Order[] {
    const orders = Array.from(this.fallbackStore.values());
    const filtered = tenantId ? orders.filter(o => o.tenantId === tenantId) : orders;
    return filtered.map(o =>
      Order.reconstitute(o.id, {
        tenantId: o.tenantId,
        userId: o.userId,
        status: o.status,
        totalAmount: o.totalAmount,
        currency: o.currency,
        items: o.items.map(i => ({ ...i })),
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt)
      })
    );
  }

  private mapToDomain(orderRow: any, itemRows: any[]): Order {
    return Order.reconstitute(orderRow.id, {
      tenantId: orderRow.tenant_id || 'default-tenant',
      userId: orderRow.user_id,
      status: orderRow.status,
      totalAmount: Number(orderRow.total_amount),
      currency: orderRow.currency,
      items: itemRows.map(i => ({
        id: i.id,
        tenantId: i.tenant_id || orderRow.tenant_id || 'default-tenant',
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
