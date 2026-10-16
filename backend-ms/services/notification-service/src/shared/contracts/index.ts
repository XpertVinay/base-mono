export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DomainIntegrationEvent<T = unknown> {
  id: string;
  eventName: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
  version: number;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OrderDto {
  id: string;
  userId: string;
  status: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionDto {
  id: string;
  referenceId: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureReason?: string;
  provider?: string;
  providerSessionId?: string;
  providerTransactionId?: string;
  redirectUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDto {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigDto {
  key: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  updatedAt: string;
}

export interface NotificationDto {
  id: string;
  recipient: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  sentAt?: string;
  createdAt: string;
}

export interface JobDto {
  id: string;
  name: string;
  cronExpression: string;
  status: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
}

export interface SearchResultItemDto {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface InventoryItemDto {
  productId: string;
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  updatedAt: string;
}
