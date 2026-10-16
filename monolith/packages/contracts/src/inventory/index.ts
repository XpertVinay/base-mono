export interface InventoryItemDto {
  productId: string;
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  updatedAt: string;
}

export interface ReserveStockRequestDto {
  productId: string;
  quantity: number;
  orderId: string;
}

export interface ReleaseStockRequestDto {
  productId: string;
  quantity: number;
  orderId: string;
}
