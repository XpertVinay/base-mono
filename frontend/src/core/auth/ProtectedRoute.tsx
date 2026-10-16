import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import { UserRole } from './types';
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

  // Cross-tenant session protection check
  if (user.tenantId && user.tenantId !== tenant.identity.id) {
    // If user's session belongs to another tenant, require sign in to this tenant
    return <Navigate to="/login" state={{ from: location, message: 'tenant_mismatch' }} replace />;
  }

  // Role verification check
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
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
  }

  return <>{children}</>;
};
