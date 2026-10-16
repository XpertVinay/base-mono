import { tenantRegistry } from '../../src/core/tenant/tenantRegistry';
import { TenantResolver } from '../../src/core/tenant/tenantResolver';

describe('Tenant Registry and Resolution', () => {
  it('retrieves registered tenants by slug', () => {
    const apex = tenantRegistry.getBySlug('apex-retail');
    expect(apex.displayName).toBe('Apex Retail');
    expect(apex.industry).toBe('retail');

    const nexus = tenantRegistry.getBySlug('nexus-health');
    expect(nexus.displayName).toBe('Nexus Health');
    expect(nexus.industry).toBe('healthcare');
  });

  it('falls back safely to default tenant when slug is unknown', () => {
    const unknown = tenantRegistry.getBySlug('non-existent-tenant-xyz');
    expect(unknown.tenantSlug).toBe('default');
    expect(unknown.displayName).toBe('Enterprise Platform');
  });

  it('resolves active tenant from storage and updates dynamically', async () => {
    await TenantResolver.setActiveTenantSlug('nexus-health');
    const resolved = await TenantResolver.resolveActiveTenant();
    expect(resolved.tenantSlug).toBe('nexus-health');

    // Switch back
    await TenantResolver.setActiveTenantSlug('apex-retail');
    const switched = await TenantResolver.resolveActiveTenant();
    expect(switched.tenantSlug).toBe('apex-retail');
  });
});
