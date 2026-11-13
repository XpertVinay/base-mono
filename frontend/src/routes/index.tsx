import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenant } from '../core/tenant/TenantContext';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { OidcCallbackPage } from '../features/auth/OidcCallbackPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { RecordsPage } from '../features/records/RecordsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AuditMonitoringPage } from '../features/audit-monitoring/AuditMonitoringPage';
import { IamControlPlanePage } from '../features/iam/IamControlPlanePage';
import { UnknownTenantPage } from '../features/system/UnknownTenantPage';
import { TenantLoadingPage } from '../features/system/TenantLoadingPage';
import { NotFoundPage } from '../features/system/NotFoundPage';

export const AppRoutes: React.FC = () => {
  const { status } = useTenant();

  if (status === 'loading') {
    return <TenantLoadingPage />;
  }

  if (status === 'unknown' || status === 'invalid') {
    return <UnknownTenantPage />;
  }

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OidcCallbackPage />} />
        <Route path="/auth/callback/:provider" element={<OidcCallbackPage />} />
      </Route>

      {/* Protected Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/analytics" element={<RecordsPage />} />
        <Route path="/audit-monitoring" element={<AuditMonitoringPage />} />
        <Route path="/audit" element={<AuditMonitoringPage />} />
        <Route path="/iam" element={<IamControlPlanePage />} />
        <Route path="/security" element={<IamControlPlanePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Navigation & IAM Section Aliases */}
        <Route path="/organization" element={<Navigate to="/settings" replace />} />
        <Route path="/users" element={<Navigate to="/iam?tab=profile" replace />} />
        <Route path="/roles" element={<Navigate to="/iam?tab=profile#permissions" replace />} />
        <Route path="/tenants" element={<Navigate to="/iam?tab=tenants" replace />} />
        <Route path="/sessions" element={<Navigate to="/iam?tab=sessions" replace />} />
        <Route path="/providers" element={<Navigate to="/iam?tab=providers" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Path-based tenant redirection helper (e.g. /t/:tenantSlug -> /) */}
      <Route path="/t/:tenantSlug/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
