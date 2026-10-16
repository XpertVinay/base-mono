import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../core/tenant/TenantContext';
import { MetricsWidget } from './widgets/MetricsWidget';
import { IndustrySpecificWidget } from './widgets/IndustrySpecificWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { ActivityWidget } from './widgets/ActivityWidget';
import { Badge } from '../../components/ui/Badge/Badge';
import styles from './DashboardPage.module.css';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant, isFeatureEnabled } = useTenant();

  const renderWidget = (widgetType: string) => {
    switch (widgetType) {
      case 'metrics':
        return <MetricsWidget />;
      case 'industry_highlight':
        return <IndustrySpecificWidget />;
      case 'quick_actions':
        return <QuickActionsWidget />;
      case 'recent_activity':
        return <ActivityWidget />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Badge variant="primary">{tenant.industry.toUpperCase()}</Badge>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
              Tenant ID: {tenant.identity.id}
            </span>
          </div>
          <h1 className={styles.title}>{t('dashboard.title')}</h1>
          <p className={styles.subtitle}>
            {tenant.identity.displayName} — {t('dashboard.subtitle')}
          </p>
        </div>
      </div>

      <div className={styles.widgetsGrid}>
        {tenant.features.dashboardWidgets.map((widget) => {
          if (widget.requiredFeature && !isFeatureEnabled(widget.requiredFeature)) {
            return null;
          }

          return (
            <div
              key={widget.id}
              style={{
                gridColumn: `span ${widget.layout.colSpan}`,
              }}
            >
              {renderWidget(widget.widgetType)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
