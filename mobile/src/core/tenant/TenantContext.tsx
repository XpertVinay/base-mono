import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { TenantConfig, TenantContextValue } from './types';
import { tenantRegistry } from './tenantRegistry';
import { TenantResolver } from './tenantResolver';

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialSlug?: string;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, initialSlug }) => {
  const [tenant, setTenant] = useState<TenantConfig>(() =>
    initialSlug ? tenantRegistry.getBySlug(initialSlug) : tenantRegistry.getDefault()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function initTenant() {
      try {
        const resolved = await TenantResolver.resolveActiveTenant();
        if (isMounted) {
          setTenant(resolved);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Tenant resolution error'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    initTenant();
    return () => {
      isMounted = false;
    };
  }, []);

  const switchTenant = useCallback(async (slug: string) => {
    try {
      setIsLoading(true);
      const updated = await TenantResolver.setActiveTenantSlug(slug);
      setTenant(updated);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to switch tenant'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const availableTenants = useMemo(() => tenantRegistry.getAll(), []);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      tenantSlug: tenant.tenantSlug,
      availableTenants,
      switchTenant,
      isLoading,
      error,
    }),
    [tenant, availableTenants, switchTenant, isLoading, error]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
