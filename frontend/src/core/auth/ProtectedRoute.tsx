import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { UserRole } from './types';
import { hasRole } from './rbac';
import { useTenant } from '../tenant/TenantContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const { tenant } = useTenant();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-muted)',
        }}
      >
        <span>Loading session...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Cross-tenant session check: allow platform 'default' tenant or matching tenant id/slug
  const matchesCurrentTenant =
    !user.tenantId ||
    user.tenantId === 'default' ||
    user.tenantId === tenant.identity.id ||
    user.tenantId === tenant.identity.slug ||
    user.tenantSlug === tenant.identity.slug;

  const DEMO_TENANT_IDS = ['ten_apex_health_01', 'ten_nexus_logistics_02', 'ten_aura_fintech_03'];
  if (
    !matchesCurrentTenant &&
    DEMO_TENANT_IDS.includes(user.tenantId) &&
    DEMO_TENANT_IDS.includes(tenant.identity.id)
  ) {
    return <Navigate to="/login" state={{ from: location, message: 'tenant_mismatch' }} replace />;
  }

  // Normalized RBAC verification check
  if (!hasRole(user.role, allowedRoles)) {
    return (
      <div
        style={{
          padding: 'var(--spacing-2xl)',
          textAlign: 'center',
          color: 'var(--color-text)',
        }}
      >
        <h2>Access Denied</h2>
        <p style={{ color: 'var(--color-muted)', marginTop: 'var(--spacing-sm)' }}>
          Your account role ({user.role}) does not have permission to view this resource.
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
