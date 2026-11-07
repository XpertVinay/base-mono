import { DomainIntegrationEvent } from '../common/index.js';

export type TransactionType = 'PAYMENT' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface TransactionDto {
  id: string;
  tenantId?: string;
  referenceId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  provider?: string;
  providerSessionId?: string;
  providerTransactionId?: string;
  redirectUrl?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessPaymentRequestDto {
  tenantId?: string;
  referenceId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
}

export interface TransactionCompletedPayload {
  transactionId: string;
  referenceId: string;
  userId: string;
  tenantId?: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
}

export type TransactionCompletedIntegrationEvent = DomainIntegrationEvent<TransactionCompletedPayload>;

export interface TransactionRefundedPayload {
  transactionId: string;
  referenceId: string;
  userId: string;
  tenantId?: string;
  amount: number;
  currency: string;
  reason?: string;
}

export type TransactionRefundedIntegrationEvent = DomainIntegrationEvent<TransactionRefundedPayload>;

export interface PaymentGatewaysResponseDto {
  activeGateway: string;
  availableGateways: string[];
}

export interface InitiatePaymentRequestDto {
  tenantId?: string;
  referenceId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface InitiatePaymentResponseDto {
  transactionId: string;
  tenantId?: string;
  referenceId: string;
  status: TransactionStatus;
  provider: string;
  redirectUrl: string;
  providerSessionId: string;
}

export interface RefundPaymentRequestDto {
  reason?: string;
  amount?: number;
}

export interface RefundPaymentResponseDto {
  transactionId: string;
  referenceId: string;
  status: TransactionStatus;
  amount: number;
  refundedAmount: number;
  reason?: string;
}

export interface TenantGatewayConfigDto {
  tenantId: string;
  activeGateway: string;
  availableGateways: string[];
}
