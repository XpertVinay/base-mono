import React from 'react';
import { useTenant } from '../../core/tenant/TenantContext';
import { AuditMonitoringApp } from './AuditMonitoringApp';

export const AuditMonitoringPage: React.FC = () => {
  const { tenant } = useTenant();

  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      <AuditMonitoringApp
        standalone={false}
        tenantId={tenant.identity.displayName || tenant.identity.slug}
        apiBaseUrl="/api/v1/audit"
        grafanaUrl="http://localhost:3000"
        prometheusUrl="http://localhost:9090"
      />
    </div>
  );
};

export default AuditMonitoringPage;
