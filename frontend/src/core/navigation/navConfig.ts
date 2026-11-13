import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Database,
  Truck,
  Coins,
  BarChart3,
  LineChart,
  TrendingUp,
  Building2,
  Layers,
  Palette,
  Users,
  UserCheck,
  Activity,
  Link2,
  ShieldCheck,
  ShieldAlert,
  ServerCog,
  ArrowRightLeft,
  Settings,
  Sliders,
  KeyRound,
  Lock,
} from 'lucide-react';
import { User, UserRole } from '../auth/types';
import { hasRole, normalizeRole, isPlatformAdmin } from '../auth/rbac';
import { TenantConfig, TenantNavigationItem } from '../tenant/types';

export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Database,
  Truck,
  Coins,
  BarChart3,
  LineChart,
  TrendingUp,
  Building2,
  Layers,
  Palette,
  Users,
  UserCheck,
  Activity,
  Link2,
  ShieldCheck,
  ShieldAlert,
  ServerCog,
  ArrowRightLeft,
  Settings,
  Sliders,
  KeyRound,
  Lock,
};

export type NavBadgeVariant = 'primary' | 'success' | 'warning' | 'neutral' | 'danger';

export interface NavItemConfig {
  key: string;
  labelKey: string;
  defaultLabel: string;
  path: string;
  icon: string;
  roles?: UserRole[];
  requiredFeature?: string;
  badge?: string;
  badgeVariant?: NavBadgeVariant;
  platformAdminOnly?: boolean;
  description?: string;
  exact?: boolean;
}

export interface NavGroupConfig {
  id: string;
  titleKey: string;
  defaultTitle: string;
  icon: string;
  roles?: UserRole[];
  requiredFeature?: string;
  badge?: string;
  badgeVariant?: NavBadgeVariant;
  defaultExpanded?: boolean;
  items: NavItemConfig[];
}

/**
 * Enterprise Base Navigation Groups
 * Layered with RBAC and Feature gating
 */
export const BASE_NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'workspace',
    titleKey: 'nav.groups.workspace',
    defaultTitle: 'Workspace & Operations',
    icon: 'LayoutDashboard',
    roles: ['USER', 'SUPPORT', 'ADMIN'],
    defaultExpanded: true,
    items: [
      {
        key: 'dashboard',
        labelKey: 'nav.items.dashboard',
        defaultLabel: 'Dashboard',
        path: '/',
        icon: 'LayoutDashboard',
        exact: true,
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'System telemetry and unified operational metrics',
      },
      {
        key: 'records',
        labelKey: 'nav.items.records',
        defaultLabel: 'Data Records',
        path: '/records',
        icon: 'Database',
        requiredFeature: 'records',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'Tenant entity management and dynamic vertical schemas',
      },
      {
        key: 'apiOperations',
        labelKey: 'nav.items.apiOperations',
        defaultLabel: 'API Operations & CRUD',
        path: '/api-operations',
        icon: 'ServerCog',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        badge: 'Live :4000',
        badgeVariant: 'primary',
        description: 'Interactive Swagger CRUD operations and backend telemetric inspector',
      },
      {
        key: 'analytics',
        labelKey: 'nav.items.analytics',
        defaultLabel: 'Analytics & Insights',
        path: '/analytics',
        icon: 'BarChart3',
        requiredFeature: 'analytics',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'Performance telemetry, throughput and forecasting',
      },
    ],
  },
  {
    id: 'organization',
    titleKey: 'nav.groups.organizationManagement',
    defaultTitle: 'Organization Management',
    icon: 'Building2',
    roles: ['USER', 'SUPPORT', 'ADMIN'],
    defaultExpanded: true,
    items: [
      {
        key: 'organizationProfile',
        labelKey: 'nav.items.tenantProfile',
        defaultLabel: 'Organization Profile',
        path: '/settings',
        icon: 'Building2',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'Tenant identity, legal registration, and industry vertical',
      },
      {
        key: 'tenants',
        labelKey: 'nav.items.tenantsAndPolicies',
        defaultLabel: 'Tenants & Multi-Tenancy',
        path: '/iam?tab=tenants',
        icon: 'Layers',
        roles: ['ADMIN'],
        badge: 'Admin',
        badgeVariant: 'primary',
        description: 'Tenant onboarding, database isolation & override approvals',
      },
      {
        key: 'branding',
        labelKey: 'nav.items.brandingTokens',
        defaultLabel: 'Branding & Themes',
        path: '/settings#branding',
        icon: 'Palette',
        roles: ['SUPPORT', 'ADMIN'],
        badge: 'Config',
        badgeVariant: 'neutral',
        description: 'White-label CSS tokens, color palettes and typography',
      },
    ],
  },
  {
    id: 'users',
    titleKey: 'nav.groups.userManagement',
    defaultTitle: 'User Management',
    icon: 'Users',
    roles: ['USER', 'SUPPORT', 'ADMIN'],
    defaultExpanded: true,
    items: [
      {
        key: 'userDirectory',
        labelKey: 'nav.items.userDirectory',
        defaultLabel: 'User Directory',
        path: '/iam?tab=profile',
        icon: 'UserCheck',
        roles: ['SUPPORT', 'ADMIN'],
        badge: 'Directory',
        badgeVariant: 'neutral',
        description: 'Personnel lookup, UUID inspection and active profiles',
      },
      {
        key: 'ssoSessions',
        labelKey: 'nav.items.ssoSessions',
        defaultLabel: 'Active SSO Sessions',
        path: '/iam?tab=sessions',
        icon: 'Activity',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        badge: 'Live',
        badgeVariant: 'success',
        description: 'Active session revocation, device fingerprints and Single Logout',
      },
      {
        key: 'federatedIdentities',
        labelKey: 'nav.items.federatedIdentities',
        defaultLabel: 'Federated Accounts',
        path: '/iam?tab=federated',
        icon: 'Link2',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'Linked enterprise IdPs and OAuth federation links',
      },
    ],
  },
  {
    id: 'roles',
    titleKey: 'nav.groups.roleManagement',
    defaultTitle: 'Role Management',
    icon: 'ShieldCheck',
    roles: ['SUPPORT', 'ADMIN'],
    badge: 'RBAC',
    badgeVariant: 'warning',
    defaultExpanded: true,
    items: [
      {
        key: 'permissionsMatrix',
        labelKey: 'nav.items.permissionsMatrix',
        defaultLabel: 'Roles & Permissions',
        path: '/iam?tab=profile#permissions',
        icon: 'ShieldCheck',
        roles: ['SUPPORT', 'ADMIN'],
        badge: 'RBAC',
        badgeVariant: 'warning',
        description: 'Role capabilities, endpoint authorization gates & grant status',
      },
      {
        key: 'oidcProviders',
        labelKey: 'nav.items.oidcProviders',
        defaultLabel: 'OIDC / SAML Providers',
        path: '/iam?tab=providers',
        icon: 'ServerCog',
        roles: ['ADMIN'],
        badge: 'Admin',
        badgeVariant: 'primary',
        description: 'Enterprise federation adapters, discovery & client credentials',
      },
      {
        key: 'tokenTools',
        labelKey: 'nav.items.tokenExchange',
        defaultLabel: 'Token Exchange & PKCE',
        path: '/iam?tab=sso-tokens',
        icon: 'ArrowRightLeft',
        roles: ['SUPPORT', 'ADMIN'],
        badge: 'Tools',
        badgeVariant: 'neutral',
        description: 'Service provider audience exchange & PKCE handoff tooling',
      },
    ],
  },
  {
    id: 'governance',
    titleKey: 'nav.groups.governance',
    defaultTitle: 'Governance & Audit',
    icon: 'ShieldAlert',
    requiredFeature: 'auditLogs',
    roles: ['SUPPORT', 'ADMIN'],
    badge: 'Live',
    badgeVariant: 'danger',
    defaultExpanded: false,
    items: [
      {
        key: 'auditLogs',
        labelKey: 'nav.items.auditObservability',
        defaultLabel: 'Audit & Observability',
        path: '/audit-monitoring',
        icon: 'ShieldAlert',
        requiredFeature: 'auditLogs',
        roles: ['SUPPORT', 'ADMIN'],
        badge: 'Real-time',
        badgeVariant: 'danger',
        description: 'Distributed audit stream, security event log and system telemetry',
      },
    ],
  },
  {
    id: 'settings',
    titleKey: 'nav.groups.settings',
    defaultTitle: 'Settings',
    icon: 'Settings',
    roles: ['USER', 'SUPPORT', 'ADMIN'],
    defaultExpanded: false,
    items: [
      {
        key: 'systemPreferences',
        labelKey: 'nav.items.systemPreferences',
        defaultLabel: 'System Preferences',
        path: '/settings',
        icon: 'Settings',
        roles: ['USER', 'SUPPORT', 'ADMIN'],
        description: 'Timezones, localization, currency and runtime configuration',
      },
      {
        key: 'featureModules',
        labelKey: 'nav.items.featureModules',
        defaultLabel: 'Feature Modules',
        path: '/settings#features',
        icon: 'Sliders',
        roles: ['ADMIN'],
        badge: 'Admin',
        badgeVariant: 'primary',
        description: 'Toggle modular capability flags and runtime feature gates',
      },
    ],
  },
];

interface FilterOptions {
  user: User | null;
  tenant: TenantConfig;
  isFeatureEnabled: (feature: string) => boolean;
}

/**
 * Evaluates Layered RBAC and Feature gating to build the filtered navigation menu.
 */
export function getFilteredNavGroups({
  user,
  tenant,
  isFeatureEnabled,
}: FilterOptions): NavGroupConfig[] {
  const userRole = normalizeRole(user?.role);
  const platformAdmin = isPlatformAdmin(user);

  // Check if tenant has customized items (e.g. customized icon or label for records/analytics)
  const tenantItemsByKey: Record<string, TenantNavigationItem> = {};
  if (tenant.features?.navigationItems) {
    for (const item of tenant.features.navigationItems) {
      tenantItemsByKey[item.key] = item;
    }
  }

  // Allow tenant configuration to override groups if navigationGroups is supplied
  const baseGroups = tenant.features?.navigationGroups?.length
    ? (tenant.features.navigationGroups as NavGroupConfig[])
    : BASE_NAV_GROUPS;

  const result: NavGroupConfig[] = [];

  for (const group of baseGroups) {
    // 1. Group-level RBAC check
    if (group.roles && !hasRole(userRole, group.roles)) {
      continue;
    }

    // 2. Group-level feature check
    if (group.requiredFeature && !isFeatureEnabled(group.requiredFeature)) {
      continue;
    }

    // 3. Item-level RBAC & feature evaluation
    const visibleItems: NavItemConfig[] = [];

    for (const item of group.items) {
      // Feature check
      if (item.requiredFeature && !isFeatureEnabled(item.requiredFeature)) {
        continue;
      }

      // Layered RBAC check
      if (item.roles && !hasRole(userRole, item.roles)) {
        continue;
      }

      // Platform admin check
      if (item.platformAdminOnly && !platformAdmin) {
        continue;
      }

      // Merge tenant-specific customizations if any (e.g. customized labelKey or icon)
      const tenantOverride = tenantItemsByKey[item.key];
      const mergedItem: NavItemConfig = {
        ...item,
        icon: tenantOverride?.icon || item.icon,
        labelKey: tenantOverride?.labelKey || item.labelKey,
      };

      visibleItems.push(mergedItem);
    }

    // If no items remain visible inside the group, hide the entire group
    if (visibleItems.length === 0) {
      continue;
    }

    result.push({
      ...group,
      items: visibleItems,
    });
  }

  return result;
}

/**
 * Accurately determines if a navigation item is active based on pathname, search params, and hash.
 */
export function isNavItemActive(
  itemPath: string,
  currentPathname: string,
  currentSearch: string,
  exact = false
): boolean {
  const [targetPathnameAndSearch] = itemPath.split('#');
  const [targetPathname, targetSearch] = (targetPathnameAndSearch || '').split('?');

  if (targetSearch) {
    // Items with specific query params (e.g. /iam?tab=tenants)
    if (currentPathname !== targetPathname) return false;
    const targetParams = new URLSearchParams(targetSearch);
    const currentParams = new URLSearchParams(currentSearch);
    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  }

  // Exact match requested or root path '/'
  if (exact || targetPathname === '/') {
    return currentPathname === targetPathname;
  }

  // If path matches directly
  if (currentPathname === targetPathname) {
    // If the current URL has query params (like ?tab=tenants), don't mark a bare item active
    // if other items target that specific query parameter
    if (currentSearch && currentSearch !== '?' && currentPathname === '/iam') {
      return false;
    }
    return true;
  }

  return currentPathname.startsWith(targetPathname + '/');
}

