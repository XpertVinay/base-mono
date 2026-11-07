import { InventoryItem } from '../entities/inventory.entity.js';

export interface IInventoryRepository {
  findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null>;
  findBySku(sku: string, tenantId: string): Promise<InventoryItem | null>;
  findAll(tenantId?: string): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
  update(item: InventoryItem, expectedVersion?: number): Promise<boolean>;
  delete(productId: string, tenantId: string): Promise<boolean>;
}
