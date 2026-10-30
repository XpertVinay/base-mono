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

// ============================================================================
// Multi-Tenant Organization & Membership Contracts (Sprint 03)
// ============================================================================

export type OrganizationType = 
  | 'ENTERPRISE' 
  | 'PROPERTY_MANAGEMENT' 
  | 'AGENCY' 
  | 'BROKERAGE' 
  | 'HOA' 
  | 'INDIVIDUAL';

export type OrganizationStatus = 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'ARCHIVED';

export type MembershipRole = 
  | 'ADMIN' 
  | 'MEMBER';

export type MembershipStatus = 
  | 'ACTIVE' 
  | 'PENDING' 
  | 'SUSPENDED' 
  | 'REJECTED';

export type InvitationStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'EXPIRED';

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  status: OrganizationStatus;
  ownerUserId: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationRequestDto {
  name: string;
  slug?: string;
  type?: OrganizationType;
  metadata?: Record<string, any>;
}

export interface UpdateOrganizationRequestDto {
  name?: string;
  type?: OrganizationType;
  metadata?: Record<string, any>;
}

export interface UpdateOrganizationStatusRequestDto {
  status: OrganizationStatus;
}

export interface OrganizationMembershipDto {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole | string;
  tenantRoleId?: string | null;
  status: MembershipStatus;
  userEmail?: string;
  userName?: string;
  organizationName?: string;
  joinedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateMembershipRequestDto {
  role?: MembershipRole | string;
  tenantRoleId?: string | null;
  status?: MembershipStatus;
}

export interface OrganizationInvitationDto {
  id: string;
  organizationId: string;
  invitedEmail: string;
  invitedByUserId: string;
  role: MembershipRole | string;
  tenantRoleId?: string | null;
  token?: string;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvitationRequestDto {
  email: string;
  role?: MembershipRole | string;
  tenantRoleId?: string | null;
  expiresInDays?: number;
}

export interface UserOrganizationContextDto {
  activeOrganization: OrganizationDto;
  membership: OrganizationMembershipDto;
  isOwner: boolean;
  isAdmin: boolean;
}

// ============================================================================
// Dynamic Role-Based Access Control (RBAC) & Tenant Permissions (Sprint 04)
// ============================================================================

export type PlatformPermission =
  // IAM / Tenant
  | 'iam:members:read'
  | 'iam:members:invite'
  | 'iam:members:manage'
  | 'iam:org:update'
  // Property
  | 'property:create'
  | 'property:read'
  | 'property:update'
  | 'property:delete'
  | 'property:verify'
  // Caretaking
  | 'caretaking:assign'
  | 'caretaking:revoke'
  | 'caretaking:inspect'
  | 'caretaking:threshold:set'
  // Maintenance
  | 'maintenance:ticket:create'
  | 'maintenance:ticket:update'
  | 'maintenance:quote:approve'
  | 'maintenance:p1:mobilize'
  // Finance
  | 'finance:ledger:read'
  | 'finance:expense:submit'
  | 'finance:expense:approve'
  | 'finance:disburse'
  // Rental
  | 'rental:listing:create'
  | 'rental:listing:publish'
  | 'rental:lease:sign'
  // Document
  | 'document:upload'
  | 'document:read'
  | 'document:verify_legal'
  | 'document:reject';

export const ALL_PLATFORM_PERMISSIONS: PlatformPermission[] = [
  'iam:members:read',
  'iam:members:invite',
  'iam:members:manage',
  'iam:org:update',
  'property:create',
  'property:read',
  'property:update',
  'property:delete',
  'property:verify',
  'caretaking:assign',
  'caretaking:revoke',
  'caretaking:inspect',
  'caretaking:threshold:set',
  'maintenance:ticket:create',
  'maintenance:ticket:update',
  'maintenance:quote:approve',
  'maintenance:p1:mobilize',
  'finance:ledger:read',
  'finance:expense:submit',
  'finance:expense:approve',
  'finance:disburse',
  'rental:listing:create',
  'rental:listing:publish',
  'rental:lease:sign',
  'document:upload',
  'document:read',
  'document:verify_legal',
  'document:reject'
];

export type SystemRoleName =
  | 'ORGANIZATION_OWNER'
  | 'ORGANIZATION_ADMIN'
  | 'PROPERTY_MANAGER'
  | 'CARETAKER'
  | 'FINANCE_CONTROLLER'
  | 'LEGAL_OFFICER'
  | 'TENANT'
  | 'GUEST'
  | 'ADMIN'
  | 'MEMBER';

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleName, PlatformPermission[]> = {
  ORGANIZATION_OWNER: [...ALL_PLATFORM_PERMISSIONS],
  ORGANIZATION_ADMIN: [...ALL_PLATFORM_PERMISSIONS],
  ADMIN: [...ALL_PLATFORM_PERMISSIONS],
  PROPERTY_MANAGER: [
    'iam:members:read',
    'property:create',
    'property:read',
    'property:update',
    'caretaking:assign',
    'caretaking:revoke',
    'caretaking:inspect',
    'maintenance:ticket:create',
    'maintenance:ticket:update',
    'maintenance:quote:approve',
    'finance:ledger:read',
    'finance:expense:submit',
    'rental:listing:create',
    'rental:listing:publish',
    'document:upload',
    'document:read'
  ],
  CARETAKER: [
    'property:read',
    'caretaking:inspect',
    'maintenance:ticket:create',
    'maintenance:ticket:update',
    'finance:expense:submit',
    'document:upload',
    'document:read'
  ],
  FINANCE_CONTROLLER: [
    'iam:members:read',
    'property:read',
    'finance:ledger:read',
    'finance:expense:submit',
    'finance:expense:approve',
    'finance:disburse',
    'document:upload',
    'document:read'
  ],
  LEGAL_OFFICER: [
    'iam:members:read',
    'property:read',
    'property:verify',
    'rental:lease:sign',
    'document:upload',
    'document:read',
    'document:verify_legal',
    'document:reject'
  ],
  TENANT: [
    'property:read',
    'maintenance:ticket:create',
    'rental:lease:sign',
    'document:read'
  ],
  GUEST: [
    'property:read'
  ],
  MEMBER: [
    'property:read',
    'maintenance:ticket:create',
    'document:read'
  ]
};

export interface TenantRoleDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: PlatformPermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleRequestDto {
  name: string;
  description?: string;
  permissions: PlatformPermission[];
}

export interface UpdateRolePermissionsRequestDto {
  permissions: PlatformPermission[];
}

export interface TenantUserPermissionsDto {
  userId: string;
  tenantId: string;
  isOwner: boolean;
  roles: string[];
  permissions: PlatformPermission[];
}

export interface AssignRoleRequestDto {
  roleId: string;
}
