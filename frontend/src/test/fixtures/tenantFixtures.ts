import { DEMO_TENANTS, DEFAULT_TENANT, DEFAULT_TENANT_SLUG } from '../../core/tenant/registry';
import { TenantConfig } from '../../core/tenant/types';

export const mockApexTenant: TenantConfig = DEMO_TENANTS['apex-health']!;
export const mockNexusTenant: TenantConfig = DEMO_TENANTS['nexus-logistics']!;
export const mockAuraTenant: TenantConfig = DEMO_TENANTS['aura-fintech']!;

export const defaultTenant: TenantConfig = DEFAULT_TENANT;
export const defaultTenantSlug: string = DEFAULT_TENANT_SLUG;

export const validTenantSlugs = ['apex-health', 'nexus-logistics', 'aura-fintech'] as const;
export const unknownTenantSlug = 'unknown-tenant-corp-404';

export const demoTenantIds = {
  apex: 'ten_apex_health_01',
  nexus: 'ten_nexus_logistics_02',
  aura: 'ten_aura_fintech_03',
  platform: 'default',
};
