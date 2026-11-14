import { MultiTenancyConfig, MultiTenancyMode } from '../../contracts/index.js';

export function getMultiTenancyConfig(): MultiTenancyConfig {
  const enabled = process.env.MULTI_TENANCY_ENABLED !== 'false';
  const rawMode = (process.env.MULTI_TENANCY_MODE || 'optional').toLowerCase();
  const mode: MultiTenancyMode = !enabled
    ? 'disabled'
    : rawMode === 'strict' || rawMode === 'disabled'
      ? (rawMode as MultiTenancyMode)
      : 'optional';

  return {
    enabled,
    mode,
    defaultTenantId: process.env.DEFAULT_TENANT_ID || 'default',
    tenantHeader: (process.env.TENANT_HEADER || 'x-tenant-id').toLowerCase(),
    tenantSlugHeader: (process.env.TENANT_SLUG_HEADER || 'x-tenant-slug').toLowerCase(),
    subdomainEnabled: process.env.TENANT_SUBDOMAIN_ENABLED === 'true'
  };
}
