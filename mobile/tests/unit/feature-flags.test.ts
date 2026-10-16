import { isFeatureEnabled, DefaultFeatureFlags } from '../../src/core/features/featureFlags';
import { apexRetailTenant } from '../../src/core/tenant/tenants/apexRetail';
import { nexusHealthTenant } from '../../src/core/tenant/tenants/nexusHealth';

describe('Feature Flags Evaluation', () => {
  it('correctly evaluates enabled features for Apex Retail', () => {
    expect(isFeatureEnabled(apexRetailTenant, 'orderTracking')).toBe(true);
    expect(isFeatureEnabled(apexRetailTenant, 'appointmentBooking')).toBe(false);
    expect(isFeatureEnabled(apexRetailTenant, 'darkMode')).toBe(true);
  });

  it('correctly evaluates enabled features for Nexus Health', () => {
    expect(isFeatureEnabled(nexusHealthTenant, 'orderTracking')).toBe(false);
    expect(isFeatureEnabled(nexusHealthTenant, 'appointmentBooking')).toBe(true);
    expect(isFeatureEnabled(nexusHealthTenant, 'darkMode')).toBe(false);
  });

  it('falls back to default feature flags if flag is not explicitly defined', () => {
    const minimalTenant = {
      ...apexRetailTenant,
      enabledFeatures: {} as any,
    };
    expect(isFeatureEnabled(minimalTenant, 'profile')).toBe(DefaultFeatureFlags.profile);
  });
});
