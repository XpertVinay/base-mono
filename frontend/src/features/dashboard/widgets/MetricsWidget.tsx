import React from 'react';
import { TrendingUp, Users, Activity, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../../core/tenant/TenantContext';
import { formatCurrency, formatNumber } from '../../../core/i18n/formatters';
import { Card, CardBody } from '../../../components/ui/Card/Card';

export const MetricsWidget: React.FC = () => {
  const { tenant } = useTenant();

  const getMetricsData = () => {
    switch (tenant.industry) {
      case 'healthcare':
        return [
          {
            label: 'Admitted Patients',
            value: formatNumber(1248, tenant.localization),
            change: '+5.4% this week',
            isPositive: true,
            icon: Users,
          },
          {
            label: 'Telemetry Active Feeds',
            value: formatNumber(342, tenant.localization),
            change: '99.98% uptime',
            isPositive: true,
            icon: Activity,
          },
          {
            label: 'Monthly Care Budget',
            value: formatCurrency(185400, tenant.localization),
            change: '-2.1% under plan',
            isPositive: true,
            icon: TrendingUp,
          },
          {
            label: 'HIPAA Compliance',
            value: '100% Certified',
            change: 'Audit passed',
            isPositive: true,
            icon: ShieldCheck,
          },
        ];
      case 'logistics':
        return [
          {
            label: 'Active Shipments',
            value: formatNumber(3840, tenant.localization),
            change: '+12.8% volume',
            isPositive: true,
            icon: Activity,
          },
          {
            label: 'Fleet Drivers Online',
            value: formatNumber(482, tenant.localization),
            change: '94% on-route',
            isPositive: true,
            icon: Users,
          },
          {
            label: 'Monthly Freight Revenue',
            value: formatCurrency(592000, tenant.localization),
            change: '+8.3% MoM',
            isPositive: true,
            icon: TrendingUp,
          },
          {
            label: 'On-Time Dispatch Rate',
            value: '98.7%',
            change: '+0.5% gain',
            isPositive: true,
            icon: ShieldCheck,
          },
        ];
      case 'fintech':
      default:
        return [
          {
            label: 'Assets Under Custody',
            value: formatCurrency(14250000, tenant.localization),
            change: '+14.2% annualized',
            isPositive: true,
            icon: TrendingUp,
          },
          {
            label: 'Active Institutional Desks',
            value: formatNumber(189, tenant.localization),
            change: '+8 desks onboarded',
            isPositive: true,
            icon: Users,
          },
          {
            label: 'Daily Clearing Volume',
            value: formatCurrency(3450000, tenant.localization),
            change: 'Real-time gross settled',
            isPositive: true,
            icon: Activity,
          },
          {
            label: 'Treasury Reserve Ratio',
            value: '124.5%',
            change: 'Fully collateralized',
            isPositive: true,
            icon: ShieldCheck,
          },
        ];
    }
  };

  const metrics = getMetricsData();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 'var(--spacing-md)',
      }}
    >
      {metrics.map((m, idx) => {
        const IconComponent = m.icon;
        return (
          <Card key={idx} hoverable>
            <CardBody style={{ padding: 'var(--spacing-lg)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {m.label}
                </span>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-primary-fixed)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconComponent size={18} />
                </div>
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  marginBottom: '4px',
                  fontFamily: 'var(--font-family-heading)',
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.value}
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: m.isPositive ? 'var(--color-success)' : 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                {m.change}
              </span>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};
