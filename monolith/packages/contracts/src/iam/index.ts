import { DomainIntegrationEvent } from '../common/index.js';

export type UserRole = 
  | 'ADMIN' 
  | 'USER' 
  | 'AUDITOR' 
  | 'OWNER' 
  | 'CARETAKER' 
  | 'TENANT' 
  | 'BUYER' 
  | 'VENDOR' 
  | 'AGENT' 
  | 'LEGAL';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  isActive: boolean;
  mfaEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  tenantId?: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  tenantId?: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  user: UserDto;
  tenantId?: string;
  mfaVerified?: boolean;
  mfaVerifiedAt?: string;
}

export interface MfaChallengeResponseDto {
  mfaRequired: true;
  mfaChallengeToken: string;
  methods: ('totp' | 'backup_code')[];
  userId: string;
  email: string;
  expiresInSeconds: number;
}

export type LoginResultDto = AuthTokensDto | MfaChallengeResponseDto;

export interface RefreshTokenRequestDto {
  refreshToken: string;
}

export interface MfaSetupResponseDto {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}

export interface MfaEnableRequestDto {
  code: string;
  secret?: string;
}

export interface MfaVerifyRequestDto {
  mfaChallengeToken: string;
  code: string;
}

export interface MfaReverifyRequestDto {
  code: string;
}

export interface MfaDisableRequestDto {
  code: string;
  password?: string;
}

export interface MfaStatusResponseDto {
  enabled: boolean;
  enrolledAt?: string | null;
  lastVerifiedAt?: string | null;
  methods: string[];
  reverificationWindowSeconds: number;
}

export interface MfaProtectedRouteDto {
  id: string;
  method: string;
  pathPattern: string;
  description?: string;
  reverificationMode: 'SESSION_24H' | 'EVERY_TIME';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMfaProtectedRouteDto {
  method: string;
  pathPattern: string;
  description?: string;
  reverificationMode?: 'SESSION_24H' | 'EVERY_TIME';
}

export interface IamAuditLogDto {
  id: string;
  userId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any>;
  status: 'SUCCESS' | 'FAILURE';
  createdAt: string;
}

export interface SsoInitiateRequestDto {
  provider: 'google' | 'azure-ad' | 'okta' | 'mock-sso';
  redirectUri?: string;
}

export interface SsoInitiateResponseDto {
  authorizationUrl: string;
  state: string;
  nonce: string;
  provider: string;
}

export interface SsoCallbackRequestDto {
  provider: string;
  code?: string;
  state: string;
  idToken?: string;
  mockProfile?: {
    email: string;
    name: string;
    subjectId?: string;
  };
}

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export type UserRegisteredIntegrationEvent = DomainIntegrationEvent<UserRegisteredPayload>;
