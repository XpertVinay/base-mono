import { DomainIntegrationEvent } from '../common/index.js';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPED' | 'CANCELLED';

export interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDto {
  id: string;
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
}

export interface OrderCreatedPayload {
  orderId: string;
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
export type OrderPaidIntegrationEvent = DomainIntegrationEvent<{ orderId: string; transactionId: string; amount: number }>;
