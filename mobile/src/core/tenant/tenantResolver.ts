import { TenantConfig } from './types';
import { tenantRegistry } from './tenantRegistry';
import { appStorage, StorageKeys } from '../storage';

export class TenantResolver {
  public static async resolveActiveTenantSlug(): Promise<string> {
    try {
      const storedSlug = await appStorage.getItem(StorageKeys.TENANT_SLUG);
      if (storedSlug) {
        return storedSlug;
      }
    } catch (err) {
      console.warn('[TenantResolver] Failed to read stored tenant slug:', err);
    }
    return tenantRegistry.getDefault().tenantSlug;
  }

  public static async resolveActiveTenant(): Promise<TenantConfig> {
    const slug = await this.resolveActiveTenantSlug();
    return tenantRegistry.getBySlug(slug);
  }

  public static async setActiveTenantSlug(slug: string): Promise<TenantConfig> {
    const tenant = tenantRegistry.getBySlug(slug);
    await appStorage.setItem(StorageKeys.TENANT_SLUG, tenant.tenantSlug);
    return tenant;
  }

  /**
   * Extension point: Resolve tenant dynamically from an authenticated user profile or remote API
   */
  public static async resolveFromUserProfile(userTenantIdOrSlug?: string): Promise<TenantConfig> {
    if (!userTenantIdOrSlug) {
      return this.resolveActiveTenant();
    }
    const tenant = tenantRegistry.getBySlug(userTenantIdOrSlug);
    await this.setActiveTenantSlug(tenant.tenantSlug);
    return tenant;
  }
}
