import { useTenant } from '../tenant/TenantContext';
import { FeatureFlagKey } from '../tenant/types';
import { isFeatureEnabled } from './featureFlags';

export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const { tenant } = useTenant();
  return isFeatureEnabled(tenant, flag);
}
