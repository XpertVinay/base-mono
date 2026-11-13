import { IInventoryRepository, ListInventoryOptions } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresInventoryRepository implements IInventoryRepository {
  async findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at
       FROM inventory.inventory_items
       WHERE product_id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [productId, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findBySku(sku: string, tenantId?: string): Promise<InventoryItem | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at
       FROM inventory.inventory_items
       WHERE sku = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [sku, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findAll(tenantId?: string, options: ListInventoryOptions = {}): Promise<{ items: InventoryItem[]; total: number }> {
    const tid = tenantId || 'default';
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["(tenant_id = $1 OR tenant_id = 'default')"];
    const params: any[] = [tid];

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(sku ILIKE $${params.length} OR product_id ILIKE $${params.length})`);
    }

    if (options.lowStock) {
      conditions.push('available_quantity <= 10');
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await dbPool.query(
      `SELECT COUNT(*) as count FROM inventory.inventory_items WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const res = await dbPool.query(
      `SELECT product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at
       FROM inventory.inventory_items
       WHERE ${whereClause}
       ORDER BY updated_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const items = res.rows.map(row => this.mapToDomain(row));
    return { items, total };
  }

  async reserveAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `UPDATE inventory.inventory_items
       SET available_quantity = available_quantity - $2,
           reserved_quantity = reserved_quantity + $2,
           updated_at = NOW()
       WHERE product_id = $1 AND (tenant_id = $3 OR tenant_id = 'default') AND available_quantity >= $2
       RETURNING product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at`,
      [productId, quantity, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async releaseAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `UPDATE inventory.inventory_items
       SET available_quantity = available_quantity + $2,
           reserved_quantity = GREATEST(0, reserved_quantity - $2),
           updated_at = NOW()
       WHERE product_id = $1 AND (tenant_id = $3 OR tenant_id = 'default')
       RETURNING product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at`,
      [productId, quantity, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async save(item: InventoryItem): Promise<void> {
    await dbPool.query(
      `INSERT INTO inventory.inventory_items (product_id, tenant_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id) DO UPDATE
       SET tenant_id = EXCLUDED.tenant_id,
           available_quantity = EXCLUDED.available_quantity,
           reserved_quantity = EXCLUDED.reserved_quantity,
           total_quantity = EXCLUDED.total_quantity,
           updated_at = EXCLUDED.updated_at`,
      [
        item.productId,
        item.tenantId,
        item.sku,
        item.availableQuantity,
        item.reservedQuantity,
        item.totalQuantity,
        item.updatedAt
      ]
    );
  }

  async update(item: InventoryItem): Promise<void> {
    await dbPool.query(
      `UPDATE inventory.inventory_items
       SET tenant_id = $2, available_quantity = $3, reserved_quantity = $4, total_quantity = $5, updated_at = $6, sku = $7
       WHERE product_id = $1`,
      [
        item.productId,
        item.tenantId,
        item.availableQuantity,
        item.reservedQuantity,
        item.totalQuantity,
        item.updatedAt,
        item.sku
      ]
    );
  }

  async delete(productId: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      'DELETE FROM inventory.inventory_items WHERE product_id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')',
      [productId, tid]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): InventoryItem {
    return InventoryItem.create(row.product_id, {
      tenantId: row.tenant_id || 'default',
      sku: row.sku,
      availableQuantity: parseInt(row.available_quantity, 10),
      reservedQuantity: parseInt(row.reserved_quantity, 10),
      totalQuantity: parseInt(row.total_quantity, 10),
      updatedAt: new Date(row.updated_at)
    });
  }
}
