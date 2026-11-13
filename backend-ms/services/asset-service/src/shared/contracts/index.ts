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
  tenantId?: string;
}

export type MultiTenancyMode = 'disabled' | 'optional' | 'strict';

export interface MultiTenancyConfig {
  enabled: boolean;
  mode: MultiTenancyMode;
  defaultTenantId: string;
  tenantHeader: string;
  tenantSlugHeader: string;
  subdomainEnabled: boolean;
}

export interface TenantContext {
  tenantId: string;
  tenantSlug?: string;
  source: 'jwt' | 'gateway' | 'header' | 'query' | 'subdomain' | 'default';
  isDefault: boolean;
  verified: boolean;
  multiTenancyEnabled: boolean;
  mode: MultiTenancyMode;
}

export interface TenantConfigDto {
  allowLocalLogin: boolean;
  allowFederatedLogin: boolean;
  autoProvisionUsers: boolean;
  defaultRole: 'USER' | 'ADMIN' | 'SUPPORT';
  allowedEmailDomains: string[];
  sessionTtlSeconds: number;
}

export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  config: TenantConfigDto;
  createdAt: string;
  updatedAt: string;
}

export type OidcProviderType =
  | 'GENERIC_OIDC'
  | 'GOOGLE'
  | 'ENTRA_ID'
  | 'OKTA'
  | 'KEYCLOAK'
  | 'MOCK';

export interface OidcProviderPublicDto {
  id: string;
  tenantId: string;
  slug: string;
  providerType: OidcProviderType;
  displayName: string;
  scopes: string;
  usePkce: boolean;
  authorizeUrl: string;
}

export interface OidcProviderDto {
  id: string;
  tenantId: string;
  slug: string;
  providerType: OidcProviderType;
  displayName: string;
  issuerUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string;
  usePkce: boolean;
  autoProvision: boolean;
  allowedDomains: string[];
  claimMapping: Record<string, string>;
  roleMapping: Record<string, string>;
  extraAuthParams: Record<string, string>;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FederatedIdentityDto {
  id: string;
  tenantId: string;
  userId: string;
  providerId: string;
  providerSlug: string;
  subject: string;
  email?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OidcAuthInitiationDto {
  authorizationUrl: string;
  state: string;
  provider: string;
  tenantId: string;
  expiresAt: string;
}

export interface UserDto {
  id: string;
  tenantId?: string;
  email: string;
  name: string;
  role: string;
  authMethod?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: 'Bearer';
  tenantId?: string;
  tenantSlug?: string;
  authMethod?: string;
  provider?: string;
  user?: UserDto;
  isNewUser?: boolean;
  redirectUrl?: string;
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
  tenantId?: string;
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
