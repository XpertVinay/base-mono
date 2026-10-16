import { InventoryItem } from '../entities/inventory.entity.js';

export interface IInventoryRepository {
  findByProductId(productId: string): Promise<InventoryItem | null>;
  findBySku(sku: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  update(item: InventoryItem): Promise<void>;
}
