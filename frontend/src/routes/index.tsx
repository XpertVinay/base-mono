import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenant } from '../core/tenant/TenantContext';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ErrorLayout } from '../layouts/ErrorLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { OidcCallbackPage } from '../features/auth/OidcCallbackPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { RecordsPage } from '../features/records/RecordsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AuditMonitoringPage } from '../features/audit-monitoring/AuditMonitoringPage';
import { IamControlPlanePage } from '../features/iam/IamControlPlanePage';
import { ApiExplorerPage } from '../features/api-explorer/ApiExplorerPage';
import { UnknownTenantPage } from '../features/system/UnknownTenantPage';
import { TenantLoadingPage } from '../features/system/TenantLoadingPage';

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
      {/* 1. Public Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route path="/auth/callback" element={<OidcCallbackPage />} />
        <Route path="/auth/callback/:provider" element={<OidcCallbackPage />} />
      </Route>

      {/* 2. Standalone Error Routes */}
      <Route path="/403" element={<ErrorLayout statusCode={403} />} />
      <Route path="/404" element={<ErrorLayout statusCode={404} />} />
      <Route path="/500" element={<ErrorLayout statusCode={500} />} />

      {/* 3. Protected Application Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/api-operations" element={<ApiExplorerPage />} />
        <Route path="/api-explorer" element={<ApiExplorerPage />} />
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

        {/* Catch-all 404 inside AppLayout */}
        <Route path="*" element={<ErrorLayout statusCode={404} />} />
      </Route>

      {/* 4. Path-based tenant redirection helper (e.g. /t/:tenantSlug -> /) */}
      <Route path="/t/:tenantSlug/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
