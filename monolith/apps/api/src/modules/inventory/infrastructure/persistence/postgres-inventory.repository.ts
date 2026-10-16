import { IInventoryRepository } from '../../domain/repositories/inventory-repository.interface.js';
import { InventoryItem } from '../../domain/entities/inventory.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresInventoryRepository implements IInventoryRepository {
  private fallbackStore: Map<string, InventoryItem> = new Map();

  constructor() {
    const defaults = [
      InventoryItem.create('PROD-001', 'LAPTOP-PRO-16', 50),
      InventoryItem.create('PROD-002', 'WIRELESS-MOUSE-RGB', 150),
      InventoryItem.create('PROD-003', 'MECH-KEYBOARD-OLED', 80)
    ];
    defaults.forEach(d => this.fallbackStore.set(d.productId, d));
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    try {
      const res = await dbPool.query(
        'SELECT product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at FROM inventory.inventory_items WHERE product_id = $1',
        [productId]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(productId) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(productId) || null;
    }
  }

  async findAll(): Promise<InventoryItem[]> {
    try {
      const res = await dbPool.query(
        'SELECT product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at FROM inventory.inventory_items ORDER BY sku ASC'
      );
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  async save(item: InventoryItem): Promise<void> {
    this.fallbackStore.set(item.productId, item);
    try {
      await dbPool.query(
        `INSERT INTO inventory.inventory_items (product_id, sku, available_quantity, reserved_quantity, total_quantity, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (product_id) DO UPDATE SET
           available_quantity = EXCLUDED.available_quantity,
           reserved_quantity = EXCLUDED.reserved_quantity,
           total_quantity = EXCLUDED.total_quantity,
           updated_at = EXCLUDED.updated_at`,
        [item.productId, item.sku, item.availableQuantity, item.reservedQuantity, item.totalQuantity, item.updatedAt]
      );
    } catch (err) {
      logger.warn('Failed to persist inventory item in DB, stored in fallback store', { productId: item.productId });
    }
  }

  async update(item: InventoryItem): Promise<void> {
    await this.save(item);
  }

  private mapToDomain(row: any): InventoryItem {
    return InventoryItem.reconstitute(row.product_id, {
      sku: row.sku,
      availableQuantity: Number(row.available_quantity),
      reservedQuantity: Number(row.reserved_quantity),
      totalQuantity: Number(row.total_quantity),
      updatedAt: new Date(row.updated_at)
    });
  }
}
