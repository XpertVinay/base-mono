export interface InventoryItemDto {
  productId: string;
  tenantId: string;
  sku: string;
  name?: string;
  category?: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  version: number;
  updatedAt: string;
}

export interface CreateInventoryItemRequestDto {
  sku: string;
  name?: string;
  category?: string;
  initialQuantity: number;
  productId?: string;
  tenantId?: string;
}

export interface ReserveStockRequestDto {
  productId: string;
  quantity: number;
  orderId: string;
  expectedVersion?: number;
  tenantId?: string;
}

export interface ReleaseStockRequestDto {
  productId: string;
  quantity: number;
  orderId: string;
  tenantId?: string;
}

export interface CommitStockRequestDto {
  productId: string;
  quantity: number;
  orderId: string;
  tenantId?: string;
}
