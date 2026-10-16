import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { useTenant } from '../../../core/tenant/TenantContext';
import { formatDate, formatTime } from '../../../core/i18n/formatters';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';

export const ActivityWidget: React.FC = () => {
  const { tenant } = useTenant();

  const mockActivity = [
    {
      id: 'act-1',
      action: 'System Security Handshake Completed',
      actor: 'system-agent@cluster.local',
      timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
    {
      id: 'act-2',
      action: 'Batch Record Synchronization Verified',
      actor: 'admin@' + tenant.identity.slug + '.demo',
      timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    },
    {
      id: 'act-3',
      action: 'Localization & Locale Configuration Loaded',
      actor: 'runtime-engine',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ];

  return (
    <Card>
      <CardHeader title="Tenant Audit Feed" subtitle="Immutable ledger of recent tenant events" />
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {mockActivity.map((act) => (
            <div
              key={act.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--color-surface-subtle)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{act.action}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>Initiator: {act.actor}</div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Clock size={12} />
                <span>
                  {formatDate(act.timestamp, tenant.localization)} {formatTime(act.timestamp, tenant.localization)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
};
