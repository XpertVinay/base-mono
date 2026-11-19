import { User } from '../../core/auth/types';
import { AuthTokensDto, IamUserDto } from '../../features/auth/types/iam.types';

export const mockSuperAdmin: User = {
  id: 'usr_super_admin_001',
  email: 'superadmin@platform.local',
  name: 'Platform Super Admin',
  role: 'ADMIN',
  tenantId: 'default',
  tenantSlug: 'default',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Platform%20Super%20Admin',
};

export const mockTenantAdmin: User = {
  id: 'usr_tenant_admin_002',
  email: 'admin@apexhealth.demo',
  name: 'Apex Tenant Admin',
  role: 'ADMIN',
  tenantId: 'ten_apex_health_01',
  tenantSlug: 'apex-health',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Apex%20Tenant%20Admin',
};

export const mockSupportUser: User = {
  id: 'usr_support_003',
  email: 'support@apexhealth.demo',
  name: 'Apex Support Specialist',
  role: 'SUPPORT',
  tenantId: 'ten_apex_health_01',
  tenantSlug: 'apex-health',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Apex%20Support%20Specialist',
};

export const mockCustomerUser: User = {
  id: 'usr_customer_004',
  email: 'customer@apexhealth.demo',
  name: 'Jane Customer',
  role: 'USER',
  tenantId: 'ten_apex_health_01',
  tenantSlug: 'apex-health',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-02-15T00:00:00.000Z',
  updatedAt: '2026-02-15T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Jane%20Customer',
};

export const mockCrossTenantAdmin: User = {
  id: 'usr_nexus_admin_005',
  email: 'admin@nexuslogistics.demo',
  name: 'Nexus Admin',
  role: 'ADMIN',
  tenantId: 'ten_nexus_logistics_02',
  tenantSlug: 'nexus-logistics',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-01-20T00:00:00.000Z',
  updatedAt: '2026-01-20T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Nexus%20Admin',
};

export const mockCrossTenantUser: User = {
  id: 'usr_nexus_user_006',
  email: 'user@nexuslogistics.demo',
  name: 'Nexus Dispatcher',
  role: 'USER',
  tenantId: 'ten_nexus_logistics_02',
  tenantSlug: 'nexus-logistics',
  authMethod: 'LOCAL',
  isActive: true,
  createdAt: '2026-02-10T00:00:00.000Z',
  updatedAt: '2026-02-10T00:00:00.000Z',
  avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Nexus%20Dispatcher',
};

export function createMockTokens(user: User): AuthTokensDto {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
  const payload = btoa(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      authMethod: user.authMethod || 'LOCAL',
      aud: 'platform-api',
      sid: `sso_${user.id}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).replace(/=+$/, '');

  const userDto: IamUserDto = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    isActive: user.isActive ?? true,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString(),
  };

  return {
    accessToken: `${header}.${payload}.mock_sig_${user.id}`,
    refreshToken: `mock_refresh_${user.id}`,
    expiresIn: 3600,
    tokenType: 'Bearer',
    sessionId: `sso_${user.id}`,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    authMethod: user.authMethod || 'LOCAL',
    user: userDto,
  };
}
