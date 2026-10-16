import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { TenantContextValue, TenantResolutionResult } from './types';
import { resolveTenant, applyTenantMetadata } from './resolver';
import { applyThemeTokens } from '../theme/applyTheme';
import { DEMO_TENANTS, DEFAULT_TENANT } from './registry';
import { loadTenantConfigFromBackend } from './adapter';

export const TenantContext = createContext<TenantContextValue | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialSlug?: string;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, initialSlug }) => {
  const [resolution, setResolution] = useState<TenantResolutionResult>({
    tenant: null,
    status: 'loading',
    source: 'none',
  });

  const availableTenants = useMemo(() => Object.values(DEMO_TENANTS), []);

  const switchTenant = useCallback((slug: string) => {
    const target = DEMO_TENANTS[slug];
    if (target) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('dev_tenant_override', slug);
      }
      applyThemeTokens(target.branding);
      applyTenantMetadata(target);
      setResolution({
        tenant: target,
        status: 'resolved',
        source: 'dev_override',
      });
    }
  }, []);

  const isFeatureEnabled = useCallback(
    (featureKey: string): boolean => {
      if (!resolution.tenant) return false;
      return !!resolution.tenant.features.enabledFeatures[featureKey];
    },
    [resolution.tenant]
  );

  useEffect(() => {
    let isMounted = true;

    async function initTenant() {
      if (initialSlug && DEMO_TENANTS[initialSlug]) {
        const tenant = DEMO_TENANTS[initialSlug]!;
        if (isMounted) {
          applyThemeTokens(tenant.branding);
          applyTenantMetadata(tenant);
          setResolution({ tenant, status: 'resolved', source: 'default' });
        }
        return;
      }

      const res = await resolveTenant({
        tenantLoader: loadTenantConfigFromBackend,
      });

      if (!isMounted) return;

      if (res.status === 'resolved' && res.tenant) {
        applyThemeTokens(res.tenant.branding);
        applyTenantMetadata(res.tenant);
        setResolution(res);
      } else {
        setResolution(res);
      }
    }

    initTenant();

    return () => {
      isMounted = false;
    };
  }, [initialSlug]);

  const value = useMemo<TenantContextValue>(() => {
    const tenant = resolution.tenant ?? DEFAULT_TENANT;
    return {
      tenant,
      tenantSlug: tenant.identity.slug,
      availableTenants,
      switchTenant,
      isFeatureEnabled,
      status: resolution.status,
      error: resolution.error,
    };
  }, [resolution, availableTenants, switchTenant, isFeatureEnabled]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
