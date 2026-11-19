import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export type PaymentGatewayType = 'STRIPE' | 'PAYPAL' | 'RAZORPAY' | 'MOCK';
export type TransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface TransactionDto {
  id: string;
  orderId?: string;
  amount: number;
  currency: string;
  gateway: PaymentGatewayType;
  gatewayTransactionId?: string;
  status: TransactionStatus;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InitiatePaymentPayload {
  orderId?: string;
  amount: number;
  currency: string;
  gateway?: PaymentGatewayType;
  paymentMethod?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface InitiatePaymentResultDto {
  transactionId: string;
  status: TransactionStatus;
  gateway: PaymentGatewayType;
  approvalUrl?: string;
  clientSecret?: string;
}

export interface TransactionQueryParams {
  gateway?: PaymentGatewayType;
  status?: TransactionStatus;
  limit?: number;
  offset?: number;
}

export interface PaymentGatewaysResponseDto {
  gateways: PaymentGatewayType[];
  defaultGateway: PaymentGatewayType;
}

const txPath = (subPath = ''): string => `${resolveServiceEndpoint('transactions')}${subPath}`;

export const transactionsApi = {
  /**
   * List transactions for current tenant
   */
  async list(
    params?: TransactionQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<TransactionDto[]>> {
    try {
      const res = await apiClient.get<unknown>(txPath('/tenant'), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<TransactionDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List transactions for current authenticated user
   */
  async listMy(
    params?: TransactionQueryParams,
    options?: RequestContextOptions
  ): Promise<ApiResult<TransactionDto[]>> {
    try {
      const res = await apiClient.get<unknown>(txPath('/my'), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<TransactionDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get supported payment gateways
   */
  async getGateways(
    options?: RequestContextOptions
  ): Promise<ApiResult<PaymentGatewaysResponseDto>> {
    try {
      const res = await apiClient.get<unknown>(txPath('/gateways'), options);
      return unwrapEnvelope<PaymentGatewaysResponseDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Initiate a payment transaction through the configured payment gateway
   */
  async initiate(
    payload: InitiatePaymentPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<InitiatePaymentResultDto>> {
    try {
      const res = await apiClient.post<unknown>(txPath('/initiate'), payload, options);
      return unwrapEnvelope<InitiatePaymentResultDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Retrieve payment transaction details by transaction ID
   */
  async getById(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<TransactionDto>> {
    try {
      const res = await apiClient.get<unknown>(txPath(`/${encodeURIComponent(id)}`), options);
      return unwrapEnvelope<TransactionDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Refund a completed transaction
   */
  async refund(
    id: string,
    payload?: { amount?: number; reason?: string },
    options?: RequestContextOptions
  ): Promise<ApiResult<{ refunded: boolean; transactionId: string }>> {
    try {
      const res = await apiClient.post<unknown>(
        txPath(`/${encodeURIComponent(id)}/refund`),
        payload || {},
        options
      );
      return unwrapEnvelope<{ refunded: boolean; transactionId: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};

