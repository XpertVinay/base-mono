import { TenantConfig } from './types';
import { apexRetailTenant } from './tenants/apexRetail';
import { nexusHealthTenant } from './tenants/nexusHealth';
import { fallbackTenant } from './tenants/fallbackTenant';
import { validateTenantConfig } from './tenantConfig.schema';

class TenantRegistry {
  private tenants: Map<string, TenantConfig> = new Map();

  constructor() {
    this.register(fallbackTenant);
    this.register(apexRetailTenant);
    this.register(nexusHealthTenant);
  }

  public register(config: TenantConfig): void {
    const validation = validateTenantConfig(config);
    if (!validation.success) {
      console.warn(
        `[TenantRegistry] Invalid configuration for tenant ${config.tenantSlug}:`,
        validation.errors
      );
    }
    this.tenants.set(config.tenantSlug, config);
  }

  public getBySlug(slug: string): TenantConfig {
    const found = this.tenants.get(slug);
    if (!found) {
      console.warn(`[TenantRegistry] Tenant with slug "${slug}" not found, falling back to default.`);
      return fallbackTenant;
    }
    return found;
  }

  public getAll(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }

  public getDefault(): TenantConfig {
    return fallbackTenant;
  }
}

export const tenantRegistry = new TenantRegistry();
