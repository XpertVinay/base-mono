import { validateTenantConfig } from '../../src/core/tenant/tenantConfig.schema';
import { apexRetailTenant } from '../../src/core/tenant/tenants/apexRetail';
import { nexusHealthTenant } from '../../src/core/tenant/tenants/nexusHealth';
import { fallbackTenant } from '../../src/core/tenant/tenants/fallbackTenant';

describe('Tenant Configuration Validation', () => {
  it('validates apexRetailTenant configuration correctly', () => {
    const result = validateTenantConfig(apexRetailTenant);
    expect(result.success).toBe(true);
    expect(result.data?.tenantSlug).toBe('apex-retail');
    expect(result.data?.primaryColor).toBe('#2563EB');
  });

  it('validates nexusHealthTenant configuration correctly', () => {
    const result = validateTenantConfig(nexusHealthTenant);
    expect(result.success).toBe(true);
    expect(result.data?.tenantSlug).toBe('nexus-health');
    expect(result.data?.currencyCode).toBe('INR');
  });

  it('validates fallbackTenant configuration correctly', () => {
    const result = validateTenantConfig(fallbackTenant);
    expect(result.success).toBe(true);
    expect(result.data?.tenantSlug).toBe('default');
  });

  it('rejects invalid tenant configs with missing required fields', () => {
    const invalidConfig = {
      tenantId: 'bad-1',
      // missing tenantSlug, primaryColor, etc.
    };
    const result = validateTenantConfig(invalidConfig);
    expect(result.success).toBe(false);
    expect(result.errors && result.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid hex color codes', () => {
    const invalidColorConfig = {
      ...fallbackTenant,
      primaryColor: 'not-a-color',
    };
    const result = validateTenantConfig(invalidColorConfig);
    expect(result.success).toBe(false);
  });

  it('rejects invalid slug format', () => {
    const invalidSlugConfig = {
      ...fallbackTenant,
      tenantSlug: 'INVALID SLUG WITH SPACES',
    };
    const result = validateTenantConfig(invalidSlugConfig);
    expect(result.success).toBe(false);
  });
});
