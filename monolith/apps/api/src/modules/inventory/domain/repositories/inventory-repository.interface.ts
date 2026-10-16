import { InventoryItem } from '../entities/inventory.entity.js';

export interface IInventoryRepository {
  findByProductId(productId: string): Promise<InventoryItem | null>;
  findAll(): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  update(item: InventoryItem): Promise<void>;
}
