import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenant } from '../core/tenant/TenantContext';
import { ProtectedRoute } from '../core/auth/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { RecordsPage } from '../features/records/RecordsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AuditMonitoringPage } from '../features/audit-monitoring/AuditMonitoringPage';
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
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Path-based tenant redirection helper (e.g. /t/:tenantSlug -> /) */}
      <Route path="/t/:tenantSlug/*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
