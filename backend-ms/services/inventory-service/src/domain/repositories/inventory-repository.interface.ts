import { InventoryItem } from '../entities/inventory.entity.js';

export interface ListInventoryOptions {
  page?: number;
  limit?: number;
  search?: string;
  lowStock?: boolean;
}

export interface IInventoryRepository {
  findByProductId(productId: string, tenantId?: string): Promise<InventoryItem | null>;
  findBySku(sku: string, tenantId?: string): Promise<InventoryItem | null>;
  findAll(tenantId?: string, options?: ListInventoryOptions): Promise<{ items: InventoryItem[]; total: number }>;
  reserveAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null>;
  releaseAtomic(productId: string, quantity: number, tenantId?: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
  update(item: InventoryItem): Promise<void>;
  delete(productId: string, tenantId?: string): Promise<boolean>;
}
