import React from 'react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import { AuditMonitoringApp } from './AuditMonitoringApp';

export const AuditMonitoringPage: React.FC = () => {
  const { tenant } = useTenant();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      <AuditMonitoringApp
        standalone={false}
        tenantId={user?.tenantId || tenant.identity.id || tenant.identity.slug}
        authToken={token ?? undefined}
        apiBaseUrl={tenant.runtime.apiBaseUrl}
      />
    </div>
  );
};

export default AuditMonitoringPage;
