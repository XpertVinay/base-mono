import { User, UserRole } from './types';
import { IamRole } from '../../features/auth/types/iam.types';

const ROLE_ALIASES: Record<string, IamRole> = {
  ADMIN: 'ADMIN',
  admin: 'ADMIN',
  SUPPORT: 'SUPPORT',
  operator: 'SUPPORT',
  USER: 'USER',
  viewer: 'USER',
};

export function normalizeRole(role?: string | null): IamRole {
  if (!role) return 'USER';
  return ROLE_ALIASES[role] || 'USER';
}

export function hasRole(userRole: UserRole | string | undefined | null, allowedRoles?: UserRole[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  const normalizedUser = normalizeRole(userRole);
  return allowedRoles.some((r) => normalizeRole(r) === normalizedUser || r === userRole);
}

export function isAdmin(user?: User | null): boolean {
  return normalizeRole(user?.role) === 'ADMIN';
}

export function isSupportOrAdmin(user?: User | null): boolean {
  const role = normalizeRole(user?.role);
  return role === 'ADMIN' || role === 'SUPPORT';
}

export function isPlatformAdmin(user?: User | null): boolean {
  return isAdmin(user) && (!user?.tenantId || user.tenantId === 'default');
}

export interface PermissionMatrixEntry {
  capability: string;
  endpoint: string;
  roles: string[];
  granted: boolean;
  description: string;
}

export function getEffectivePermissions(user?: User | null): PermissionMatrixEntry[] {
  const role = normalizeRole(user?.role);
  const platformAdmin = isPlatformAdmin(user);

  return [
    {
      capability: 'Profile, Sessions & Linked Identities',
      endpoint: 'GET /api/v1/iam/profile, /sso/sessions, /federated-identities',
      roles: ['USER', 'SUPPORT', 'ADMIN'],
      granted: Boolean(user),
      description: 'Inspect own IAM profile, manage active SSO sessions, link/unlink IdPs, and trigger SLO.',
    },
    {
      capability: 'Service Token Exchange & SSO Handoff',
      endpoint: 'POST /api/v1/iam/sso/exchange, /sso/handoff',
      roles: ['USER', 'SUPPORT', 'ADMIN'],
      granted: Boolean(user),
      description: 'Mint audience-scoped service provider JWTs and PKCE single-use handoff codes.',
    },
    {
      capability: 'User Directory Lookup & Supported Adapters',
      endpoint: 'GET /api/v1/iam/users/:id, /oidc/admin/supported-types',
      roles: ['SUPPORT', 'ADMIN'],
      granted: role === 'SUPPORT' || role === 'ADMIN',
      description: 'Inspect tenant user profiles by UUID and query supported federation adapters.',
    },
    {
      capability: 'Tenant Policy & Federation Provider Admin',
      endpoint: 'POST/PATCH/DELETE /api/v1/iam/oidc/admin/providers, PATCH /tenants/:id',
      roles: ['ADMIN'],
      granted: role === 'ADMIN',
      description: 'Configure OIDC/OAuth2/SAML providers, test discovery, and manage tenant auth policy.',
    },
    {
      capability: 'Platform Tenant Onboarding & Override Approvals',
      endpoint: 'POST /tenants/onboard, POST /oidc/admin/providers/:id/approve|reject',
      roles: ['PLATFORM_ADMIN (default tenant ADMIN)'],
      granted: platformAdmin,
      description: 'Onboard new tenants, manage system-default IdPs, and approve/reject tenant overrides.',
    },
  ];
}

