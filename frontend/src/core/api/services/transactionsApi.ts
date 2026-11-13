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

const txPath = (subPath = ''): string => `${resolveServiceEndpoint('transactions')}${subPath}`;

export const transactionsApi = {
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
};

