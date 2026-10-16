import { describe, it, expect } from 'vitest';
import { validateTenantConfig } from '../core/tenant/schema';
import { DEMO_TENANTS } from '../core/tenant/registry';

describe('Tenant Configuration Schema Validation', () => {
  it('should validate all demo tenants successfully', () => {
    Object.values(DEMO_TENANTS).forEach((tenant) => {
      const result = validateTenantConfig(tenant);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid tenant configuration missing required fields', () => {
    const invalidConfig = {
      identity: {
        id: 'ten_missing_slug',
        // missing slug
        displayName: 'Test',
      },
    };

    const result = validateTenantConfig(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format in tenant identity', () => {
    const brokenTenant = {
      ...DEMO_TENANTS['apex-health'],
      identity: {
        ...DEMO_TENANTS['apex-health']!.identity,
        supportEmail: 'not-an-email',
      },
    };

    const result = validateTenantConfig(brokenTenant);
    expect(result.success).toBe(false);
  });
});
