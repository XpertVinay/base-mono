import { DomainIntegrationEvent } from '../common/index.js';

export type TransactionType = 'PAYMENT' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface TransactionDto {
  id: string;
  referenceId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessPaymentRequestDto {
  referenceId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
}

export interface TransactionCompletedPayload {
  transactionId: string;
  referenceId: string;
  userId: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
}

export type TransactionCompletedIntegrationEvent = DomainIntegrationEvent<TransactionCompletedPayload>;

export interface PaymentGatewaysResponseDto {
  activeGateway: string;
  availableGateways: string[];
}

export interface InitiatePaymentRequestDto {
  referenceId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface InitiatePaymentResponseDto {
  transactionId: string;
  referenceId: string;
  status: TransactionStatus;
  provider: string;
  redirectUrl: string;
  providerSessionId: string;
}
