import { InventoryItem } from '../entities/inventory.entity.js';

export interface IInventoryRepository {
  findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null>;
  findBySku(sku: string, tenantId?: string): Promise<InventoryItem | null>;
  reserveAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null>;
  releaseAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  update(item: InventoryItem): Promise<void>;
}
