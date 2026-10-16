import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresInventoryRepository implements IInventoryRepository {
  async findByProductId(productId: string): Promise<InventoryItem | null> {
    const res = await dbPool.query(
      'SELECT product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at FROM inventory.inventory_items WHERE product_id = $1',
      [productId]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findBySku(sku: string): Promise<InventoryItem | null> {
    const res = await dbPool.query(
      'SELECT product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at FROM inventory.inventory_items WHERE sku = $1',
      [sku]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async save(item: InventoryItem): Promise<void> {
    await dbPool.query(
      `INSERT INTO inventory.inventory_items (product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product_id) DO UPDATE
       SET available_quantity = EXCLUDED.available_quantity,
           reserved_quantity = EXCLUDED.reserved_quantity,
           total_quantity = EXCLUDED.total_quantity,
           updated_at = EXCLUDED.updated_at`,
      [
        item.productId,
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
       SET available_quantity = $2, reserved_quantity = $3, total_quantity = $4, updated_at = $5
       WHERE product_id = $1`,
      [
        item.productId,
        item.availableQuantity,
        item.reservedQuantity,
        item.totalQuantity,
        item.updatedAt
      ]
    );
  }

  private mapToDomain(row: any): InventoryItem {
    return InventoryItem.create(row.product_id, {
      sku: row.sku,
      availableQuantity: parseInt(row.available_quantity, 10),
      reservedQuantity: parseInt(row.reserved_quantity, 10),
      totalQuantity: parseInt(row.total_quantity, 10),
      updatedAt: new Date(row.updated_at)
    });
  }
}
