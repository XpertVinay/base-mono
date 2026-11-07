import { DomainIntegrationEvent } from '../common/index.js';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'RESERVED'
  | 'PAID'
  | 'SHIPPED'
  | 'FULFILLED'
  | 'CANCELLED';

export interface OrderItemDto {
  id: string;
  tenantId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDto {
  id: string;
  tenantId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItemDto[];
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemRequestDto {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderRequestDto {
  items: CreateOrderItemRequestDto[];
  currency?: string;
  tenantId?: string;
}

export interface CancelOrderRequestDto {
  reason?: string;
}

export interface OrderCreatedPayload {
  orderId: string;
  tenantId: string;
  userId: string;
  totalAmount: number;
  currency: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export type OrderCreatedIntegrationEvent = DomainIntegrationEvent<OrderCreatedPayload>;
export type OrderPaidIntegrationEvent = DomainIntegrationEvent<{ orderId: string; transactionId: string; amount: number; tenantId?: string }>;
export type OrderCancelledIntegrationEvent = DomainIntegrationEvent<{ orderId: string; tenantId: string; reason?: string }>;
export type OrderFulfilledIntegrationEvent = DomainIntegrationEvent<{ orderId: string; tenantId: string }>;
