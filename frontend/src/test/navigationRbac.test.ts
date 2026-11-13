import { describe, it, expect } from 'vitest';
import {
  getFilteredNavGroups,
  isNavItemActive,
} from '../core/navigation/navConfig';
import { DEFAULT_TENANT, DEMO_TENANTS } from '../core/tenant/registry';
import { User } from '../core/auth/types';

describe('Navigation Layered RBAC & Filtering', () => {
  const adminUser: User = {
    id: 'usr_admin',
    email: 'admin@enterprise.local',
    name: 'Admin User',
    role: 'ADMIN',
    tenantId: 'default',
  };

  const supportUser: User = {
    id: 'usr_support',
    email: 'support@enterprise.local',
    name: 'Support User',
    role: 'SUPPORT',
    tenantId: 'ten_apex_health_01',
  };

  const standardUser: User = {
    id: 'usr_viewer',
    email: 'user@enterprise.local',
    name: 'Regular Viewer',
    role: 'USER',
    tenantId: 'ten_apex_health_01',
  };

  const mockFeatureEnabled = (_feature: string) => true;

  it('should expose all groups and admin items for ADMIN role', () => {
    const groups = getFilteredNavGroups({
      user: adminUser,
      tenant: DEFAULT_TENANT,
      isFeatureEnabled: mockFeatureEnabled,
    });

    const groupIds = groups.map((g) => g.id);
    expect(groupIds).toContain('workspace');
    expect(groupIds).toContain('organization');
    expect(groupIds).toContain('users');
    expect(groupIds).toContain('roles');
    expect(groupIds).toContain('governance');
    expect(groupIds).toContain('settings');

    const orgGroup = groups.find((g) => g.id === 'organization')!;
    const orgItemKeys = orgGroup.items.map((i) => i.key);
    expect(orgItemKeys).toContain('tenants'); // Admin only
    expect(orgItemKeys).toContain('organizationProfile');
    expect(orgItemKeys).toContain('branding');

    const roleGroup = groups.find((g) => g.id === 'roles')!;
    const roleItemKeys = roleGroup.items.map((i) => i.key);
    expect(roleItemKeys).toContain('oidcProviders'); // Admin only
    expect(roleItemKeys).toContain('permissionsMatrix');
    expect(roleItemKeys).toContain('tokenTools');
  });

  it('should filter out ADMIN-only items for SUPPORT role but retain support-permitted items', () => {
    const groups = getFilteredNavGroups({
      user: supportUser,
      tenant: DEFAULT_TENANT,
      isFeatureEnabled: mockFeatureEnabled,
    });

    const groupIds = groups.map((g) => g.id);
    expect(groupIds).toContain('workspace');
    expect(groupIds).toContain('organization');
    expect(groupIds).toContain('users');
    expect(groupIds).toContain('roles');
    expect(groupIds).toContain('governance');
    expect(groupIds).toContain('settings');

    // Organization Management: should NOT contain tenants
    const orgGroup = groups.find((g) => g.id === 'organization')!;
    const orgItemKeys = orgGroup.items.map((i) => i.key);
    expect(orgItemKeys).not.toContain('tenants');
    expect(orgItemKeys).toContain('organizationProfile');
    expect(orgItemKeys).toContain('branding');

    // Role Management: should NOT contain oidcProviders
    const roleGroup = groups.find((g) => g.id === 'roles')!;
    const roleItemKeys = roleGroup.items.map((i) => i.key);
    expect(roleItemKeys).not.toContain('oidcProviders');
    expect(roleItemKeys).toContain('permissionsMatrix');
    expect(roleItemKeys).toContain('tokenTools');

    // Settings: should NOT contain featureModules
    const settingsGroup = groups.find((g) => g.id === 'settings')!;
    const settingsKeys = settingsGroup.items.map((i) => i.key);
    expect(settingsKeys).not.toContain('featureModules');
    expect(settingsKeys).toContain('systemPreferences');
  });

  it('should restrict role management and admin tools for standard USER role', () => {
    const groups = getFilteredNavGroups({
      user: standardUser,
      tenant: DEFAULT_TENANT,
      isFeatureEnabled: mockFeatureEnabled,
    });

    const groupIds = groups.map((g) => g.id);
    expect(groupIds).toContain('workspace');
    expect(groupIds).toContain('users');
    expect(groupIds).toContain('settings');

    // Role Management should be completely hidden for USER
    expect(groupIds).not.toContain('roles');
    // Governance & Audit should be completely hidden for USER
    expect(groupIds).not.toContain('governance');

    // In User Management, directory should be hidden, but SSO sessions and federated identities visible
    const usersGroup = groups.find((g) => g.id === 'users')!;
    const userItemKeys = usersGroup.items.map((i) => i.key);
    expect(userItemKeys).not.toContain('userDirectory');
    expect(userItemKeys).toContain('ssoSessions');
    expect(userItemKeys).toContain('federatedIdentities');
  });

  it('should filter items when feature flag is disabled', () => {
    const groups = getFilteredNavGroups({
      user: adminUser,
      tenant: DEFAULT_TENANT,
      isFeatureEnabled: (feature) => feature !== 'auditLogs' && feature !== 'analytics',
    });

    const groupIds = groups.map((g) => g.id);
    // Governance has requiredFeature 'auditLogs' so it should be omitted entirely
    expect(groupIds).not.toContain('governance');

    const workspaceGroup = groups.find((g) => g.id === 'workspace')!;
    const workspaceKeys = workspaceGroup.items.map((i) => i.key);
    expect(workspaceKeys).toContain('dashboard');
    expect(workspaceKeys).toContain('records');
    expect(workspaceKeys).not.toContain('analytics');
  });

  it('should apply tenant custom navigation item overrides', () => {
    const logisticsTenant = DEMO_TENANTS['nexus-logistics']!;
    const groups = getFilteredNavGroups({
      user: adminUser,
      tenant: logisticsTenant,
      isFeatureEnabled: mockFeatureEnabled,
    });

    const workspaceGroup = groups.find((g) => g.id === 'workspace')!;
    const recordsItem = workspaceGroup.items.find((i) => i.key === 'records')!;
    // Logistics tenant customizes labelKey to nav.shipments and icon to Truck
    expect(recordsItem.labelKey).toBe('nav.shipments');
    expect(recordsItem.icon).toBe('Truck');
  });
});

describe('isNavItemActive Helper', () => {
  it('should match root path exactly', () => {
    expect(isNavItemActive('/', '/', '')).toBe(true);
    expect(isNavItemActive('/', '/records', '')).toBe(false);
  });

  it('should match exact query parameters for tab-based links', () => {
    expect(isNavItemActive('/iam?tab=tenants', '/iam', '?tab=tenants')).toBe(true);
    expect(isNavItemActive('/iam?tab=sessions', '/iam', '?tab=tenants')).toBe(false);
    expect(isNavItemActive('/iam?tab=profile', '/iam', '?tab=tenants')).toBe(false);
  });

  it('should match path-based links without query parameters', () => {
    expect(isNavItemActive('/records', '/records', '')).toBe(true);
    expect(isNavItemActive('/settings', '/settings', '')).toBe(true);
    expect(isNavItemActive('/settings', '/records', '')).toBe(false);
  });
});
