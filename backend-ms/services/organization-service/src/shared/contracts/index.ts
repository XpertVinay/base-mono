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

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'DEACTIVATED';
export type OrganizationTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'BILLING_ADMIN';
export type MemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface OrganizationAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface OrganizationBranding {
  logoUrl?: string;
  primaryColor?: string;
  faviconUrl?: string;
}

export interface OrganizationSecuritySettings {
  enforceMfa?: boolean;
  sessionTtlSeconds?: number;
  allowedEmailDomains?: string[];
  ipWhitelist?: string[];
}

export interface OrganizationSettings {
  branding?: OrganizationBranding;
  security?: OrganizationSecuritySettings;
  features?: Record<string, boolean>;
  customDomain?: string;
  maxUsers?: number;
  timezone?: string;
  currency?: string;
}

export interface OrganizationDto {
  id: string;
  slug: string;
  name: string;
  legalName?: string;
  status: OrganizationStatus;
  tier: OrganizationTier;
  industry?: string;
  taxId?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  address?: OrganizationAddress;
  settings: OrganizationSettings;
  maxUsers: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  name: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}
