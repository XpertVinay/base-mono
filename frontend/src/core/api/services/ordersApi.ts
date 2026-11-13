import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItemInput {
  productId: string;
  sku?: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
}

export interface OrderItemDto {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDto {
  id: string;
  orderNumber?: string;
  userId?: string;
  tenantId?: string;
  status: OrderStatus;
  items: OrderItemDto[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderPayload {
  items: OrderItemInput[];
  currency?: string;
  shippingAddress?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
}

export interface OrderQueryParams {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

const ordersPath = (subPath = ''): string => `${resolveServiceEndpoint('orders')}${subPath}`;

export const ordersApi = {
  /**
   * List all orders (ADMIN / privileged)
   */
  async listOrders(
    params?: OrderQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrderDto[]>> {
    try {
      const res = await apiClient.get<unknown>(ordersPath(), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<OrderDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List orders belonging to the authenticated user
   */
  async getMyOrders(options?: RequestContextOptions): Promise<ApiResult<OrderDto[]>> {
    try {
      const res = await apiClient.get<unknown>(ordersPath('/my'), options);
      return unwrapEnvelope<OrderDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get order details by ID
   */
  async getById(id: string, options?: RequestContextOptions): Promise<ApiResult<OrderDto>> {
    try {
      const res = await apiClient.get<unknown>(ordersPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<OrderDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Create a new order with stock validation and reservation
   */
  async create(
    payload: CreateOrderPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrderDto>> {
    try {
      const res = await apiClient.post<unknown>(ordersPath(), payload, options);
      return unwrapEnvelope<OrderDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Cancel an order
   */
  async cancel(
    id: string,
    reason?: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<OrderDto>> {
    try {
      const res = await apiClient.post<unknown>(
        ordersPath(`/${encodeURIComponent(id)}/cancel`),
        { reason },
        options
      );
      return unwrapEnvelope<OrderDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

