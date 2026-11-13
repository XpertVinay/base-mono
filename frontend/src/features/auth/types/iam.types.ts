export type IamRole = 'USER' | 'ADMIN' | 'SUPPORT';
export type AuthMethod = 'LOCAL' | 'OIDC' | 'HYBRID';
export type FederationProtocol = 'OIDC' | 'OAUTH2' | 'SAML';
export type ProviderApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
export type ProviderConfigSource = 'SYSTEM_DEFAULT' | 'TENANT_OVERRIDE' | 'TENANT_CUSTOM';

export type OidcProviderType =
  | 'GENERIC_OIDC'
  | 'GENERIC_OAUTH2'
  | 'GOOGLE'
  | 'ENTRA_ID'
  | 'OKTA'
  | 'KEYCLOAK'
  | 'SAML'
  | 'MOCK';

export interface StandardMetaData {
  requestId: string;
  timestamp: string;
  debug?: Record<string, unknown>;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  } | null;
  further_steps?: string[] | null;
}

export interface StandardApiEnvelope<T = unknown> {
  status: boolean;
  message: string;
  data: T;
  errors: Array<{ code?: string; message?: string; field?: string } | string>;
  meta_data?: StandardMetaData;
}

export interface MiddlewareErrorPayload {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface IamUserDto {
  id: string;
  tenantId?: string;
  email: string;
  name: string;
  role: IamRole | string;
  authMethod?: AuthMethod | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType?: 'Bearer' | string;
  sessionId?: string;
  audience?: string;
  tenantId?: string;
  tenantSlug?: string;
  authMethod?: string;
  provider?: string;
  user?: IamUserDto;
  isNewUser?: boolean;
  redirectUrl?: string;
}

export interface LoginRequestPayload {
  email: string;
  password: string;
  tenantId?: string;
  tenantSlug?: string;
}

export interface RegisterRequestPayload {
  email: string;
  password: string;
  name: string;
  role?: IamRole;
  tenantId?: string;
  tenantSlug?: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
  tenantId?: string;
}

export interface TenantConfigDto {
  allowLocalLogin: boolean;
  allowFederatedLogin: boolean;
  autoProvisionUsers: boolean;
  defaultRole: IamRole;
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

export interface MultiTenancyStatusDto {
  enabled: boolean;
  mode: 'disabled' | 'optional' | 'strict';
  defaultTenantId: string;
  tenantHeader: string;
  tenantSlugHeader: string;
  subdomainEnabled: boolean;
  resolvedTenant?: {
    tenantId: string;
    tenantSlug?: string;
    source: string;
    isDefault: boolean;
    verified: boolean;
    multiTenancyEnabled: boolean;
    mode: string;
  };
}

export interface CreateTenantPayload {
  id?: string;
  slug: string;
  name: string;
  isActive?: boolean;
  config?: Partial<TenantConfigDto>;
}

export interface OnboardTenantPayload extends CreateTenantPayload {
  adminUser?: {
    email: string;
    password: string;
    name: string;
  };
}

export interface OnboardTenantResult {
  tenant: TenantDto;
  adminUser?: IamUserDto;
  inheritedProviders: OidcProviderPublicDto[];
}

export interface UpdateTenantPayload {
  name?: string;
  isActive?: boolean;
  config?: Partial<TenantConfigDto>;
}

export interface SamlProviderConfig {
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpSloUrl?: string;
  spEntityId?: string;
  idpCertificatePem?: string;
  nameIdFormat?: string;
  signAuthnRequest?: boolean;
  hasIdpCertificate?: boolean;
}

export interface OidcProviderPublicDto {
  id: string;
  tenantId: string;
  slug: string;
  providerType: OidcProviderType;
  protocol: FederationProtocol;
  displayName: string;
  scopes: string;
  usePkce: boolean;
  authorizeUrl: string;
  configSource: ProviderConfigSource;
  isSystemDefault: boolean;
  inheritsSystemConfig: boolean;
}

export interface OidcProviderDto {
  id: string;
  tenantId: string;
  slug: string;
  providerType: OidcProviderType;
  protocol: FederationProtocol;
  displayName: string;
  issuerUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  allowedRedirectUris: string[];
  scopes: string;
  usePkce: boolean;
  autoProvision: boolean;
  allowedDomains: string[];
  claimMapping: Record<string, string>;
  roleMapping: Record<string, string>;
  extraAuthParams: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  isSystemDefault: boolean;
  inheritsSystemConfig: boolean;
  parentProviderId?: string;
  configSource: ProviderConfigSource;
  approvalStatus: ProviderApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigureOidcProviderPayload {
  tenantId?: string;
  tenantSlug?: string;
  slug: string;
  providerType: OidcProviderType;
  protocol?: FederationProtocol;
  displayName: string;
  issuerUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  allowedRedirectUris?: string[];
  scopes?: string;
  usePkce?: boolean;
  autoProvision?: boolean;
  allowedDomains?: string[];
  claimMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  extraAuthParams?: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  isSystemDefault?: boolean;
  inheritsSystemConfig?: boolean;
  parentProviderId?: string;
  isEnabled?: boolean;
}

export interface AssociateSystemProviderPayload {
  tenantId?: string;
  tenantSlug?: string;
  systemProvider: string;
  slug?: string;
  displayName?: string;
  issuerUrl?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedRedirectUris?: string[];
  scopes?: string;
  autoProvision?: boolean;
  allowedDomains?: string[];
  claimMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  extraAuthParams?: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  inheritsSystemConfig?: boolean;
  isEnabled?: boolean;
}

export interface OidcAuthInitiationDto {
  authorizationUrl: string;
  state: string;
  provider: string;
  tenantId: string;
  expiresAt: string;
}

export interface OidcDiscoveryMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
}

export interface TokenExchangePayload {
  provider: string;
  idToken: string;
  tenantId?: string;
  tenantSlug?: string;
  nonce?: string;
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

export interface SsoSessionDto {
  id: string;
  tenantId: string;
  tenantSlug?: string;
  userId: string;
  authMethod: string;
  providerId?: string;
  providerSlug?: string;
  expiresAt: string;
  revokedAt?: string;
  revokedReason?: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface CreateSsoHandoffPayload {
  targetService: string;
  scope?: string;
  codeChallenge?: string;
  redirectUri?: string;
}

export interface SsoHandoffCodeDto {
  code: string;
  targetService: string;
  expiresAt: string;
  redirectUrl?: string;
}

export interface RedeemSsoHandoffPayload {
  code: string;
  targetService: string;
  codeVerifier?: string;
  expectedTenantId?: string;
}

export interface ExchangeServiceTokenPayload {
  targetService: string;
  scope?: string;
  expiresInSeconds?: number;
}

export interface ServiceProviderTokenDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  audience: string;
  scope?: string;
  tenantId: string;
  tenantSlug?: string;
  sessionId: string;
  authMethod: string;
  provider?: string;
}

export interface IntrospectTokenPayload {
  token: string;
  expectedTenantId?: string;
  expectedAudience?: string;
}

export interface IntrospectedTokenDto {
  active: boolean;
  reason?: string;
  sub?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  tenantSlug?: string;
  audience?: string;
  sessionId?: string;
  authMethod?: string;
  provider?: string;
  scope?: string;
  exp?: number;
}

export interface SloLogoutPayload {
  sessionId?: string;
  allSessions?: boolean;
  postLogoutRedirectUri?: string;
  state?: string;
}

export interface SloResultDto {
  loggedOut: boolean;
  sessionId?: string;
  revokedSessions: number;
  idpLogoutUrl?: string;
  backchannelNotified?: boolean;
}

export interface GatewayHealthDto {
  gateway: string;
  version: string;
  transport: string;
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  mappedServices: number;
}

