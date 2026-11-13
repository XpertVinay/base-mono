import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export interface InventoryItemDto {
  id?: string;
  productId: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warehouseId?: string;
  name?: string;
  updatedAt?: string;
}

export interface AddStockPayload {
  productId: string;
  sku: string;
  quantity: number;
  warehouseId?: string;
  name?: string;
}

export interface ReserveStockPayload {
  productId: string;
  quantity: number;
  orderId?: string;
  reservationTtlMinutes?: number;
}

const inventoryPath = (subPath = ''): string => `${resolveServiceEndpoint('inventory')}${subPath}`;

export const inventoryApi = {
  /**
   * Get available stock quantity and reservation metrics for a product
   */
  async getStock(
    productId: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<InventoryItemDto>> {
    try {
      const res = await apiClient.get<unknown>(
        inventoryPath(`/${encodeURIComponent(productId)}`),
        options
      );
      return unwrapEnvelope<InventoryItemDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Add stock quantity to existing inventory item or create new SKU inventory
   */
  async addStock(
    payload: AddStockPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<InventoryItemDto>> {
    try {
      const res = await apiClient.post<unknown>(inventoryPath('/stock'), payload, options);
      return unwrapEnvelope<InventoryItemDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Temporarily reserve stock for an order
   */
  async reserveStock(
    payload: ReserveStockPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ reserved: boolean; expiresAt?: string }>> {
    try {
      const res = await apiClient.post<unknown>(inventoryPath('/reserve'), payload, options);
      return unwrapEnvelope<{ reserved: boolean; expiresAt?: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

