import React from 'react';
import { useTenant } from '../../../core/tenant/TenantContext';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Badge } from '../../../components/ui/Badge/Badge';

export const IndustrySpecificWidget: React.FC = () => {
  const { tenant } = useTenant();

  if (tenant.industry === 'healthcare') {
    return (
      <Card>
        <CardHeader
          title="Clinical Department Bed Capacity & Triage"
          subtitle="Real-time telemetry from ICU, Cardiology, and Trauma Care units"
          action={<Badge variant="success" withDot>Live Telemetry</Badge>}
        />
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                <span>Intensive Care Unit (ICU)</span>
                <span style={{ fontWeight: 600 }}>28 / 32 Beds (87.5%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-surface-hover)', overflow: 'hidden' }}>
                <div style={{ width: '87.5%', height: '100%', backgroundColor: 'var(--color-warning)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                <span>Pediatric & Neonatal Ward</span>
                <span style={{ fontWeight: 600 }}>14 / 24 Beds (58.3%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-surface-hover)', overflow: 'hidden' }}>
                <div style={{ width: '58.3%', height: '100%', backgroundColor: 'var(--color-primary)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', marginBottom: '4px' }}>
                <span>Cardiology Surgical Suite</span>
                <span style={{ fontWeight: 600 }}>9 / 12 Suites (75%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-surface-hover)', overflow: 'hidden' }}>
                <div style={{ width: '75%', height: '100%', backgroundColor: 'var(--color-secondary)' }} />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (tenant.industry === 'logistics') {
    return (
      <Card>
        <CardHeader
          title="Transit Corridors & Regional Fleet Dispatch"
          subtitle="Real-time GPS tracking across European & North American routes"
          action={<Badge variant="primary" withDot>Tracking 482 Vehicles</Badge>}
        />
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Rotterdam $\rightarrow$ Frankfurt Express</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>18 Convoys active • Avg speed 84 km/h</div>
              </div>
              <Badge variant="success">On Schedule</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Hamburg Port Cold-Chain Feed</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>8 Reefers active • Target -20°C</div>
              </div>
              <Badge variant="success">Optimal</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Antwerp $\rightarrow$ Lyon Freight Line</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Customs inspection checkpoint delay</div>
              </div>
              <Badge variant="warning">Delayed 45m</Badge>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Fintech
  return (
    <Card>
      <CardHeader
        title="Institutional Asset Allocation & Treasury Flow"
        subtitle="Diversified collateral holdings, smart contract escrows & liquidity pools"
        action={<Badge variant="primary" withDot>Settlement Netting Active</Badge>}
      />
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Private Credit & Senior Secured Loans</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>$6,450,000 Allocation • Net IRR 9.4%</div>
            </div>
            <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>45.2%</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Sovereign Debt & Treasury Bills</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>$4,800,000 Allocation • Risk-Free 5.2%</div>
            </div>
            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>33.7%</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Overnight Fedwire Reverse Repo Liquidity</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>$3,000,000 Allocation • Immediate T+0</div>
            </div>
            <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>21.1%</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
