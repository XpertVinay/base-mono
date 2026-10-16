import { FeatureFlagKey, TenantConfig } from '../tenant/types';

export const DefaultFeatureFlags: Record<FeatureFlagKey, boolean> = {
  profile: true,
  notifications: true,
  helpAndSupport: true,
  languageSwitcher: true,
  darkMode: true,
  analytics: true,
  orderTracking: false,
  appointmentBooking: false,
  inventorySearch: false,
};

export function isFeatureEnabled(tenant: TenantConfig, flag: FeatureFlagKey): boolean {
  if (!tenant || !tenant.enabledFeatures) {
    return DefaultFeatureFlags[flag] ?? false;
  }
  const flagValue = tenant.enabledFeatures[flag];
  if (typeof flagValue === 'boolean') {
    return flagValue;
  }
  return DefaultFeatureFlags[flag] ?? false;
}
