import React from 'react';
import { useTenant } from '../../core/tenant/TenantContext';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children, fallback = null }) => {
  const { isFeatureEnabled } = useTenant();

  if (!isFeatureEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
