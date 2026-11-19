import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Users,
  Activity,
  ServerCog,
  Coins,
  BarChart3,
  ShieldCheck,
  LucideIcon,
} from 'lucide-react';
import { useTenant } from '../core/tenant/TenantContext';
import styles from './DashboardLayout.module.css';

export interface KpiMetric {
  id: string;
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode | string;
  description?: string;
}

export interface DashboardLayoutProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  metrics?: KpiMetric[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const METRIC_ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Users,
  Activity,
  ServerCog,
  Coins,
  BarChart3,
  TrendingUp,
  ShieldCheck,
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  title = 'Operations Dashboard',
  subtitle,
  badge,
  metrics,
  actions,
  children,
  className,
}) => {
  const { tenant } = useTenant();

  const renderMetricIcon = (icon?: React.ReactNode | string) => {
    if (!icon) return <Activity size={18} />;
    if (typeof icon === 'string') {
      const IconComp = METRIC_ICON_MAP[icon] || Activity;
      return <IconComp size={18} />;
    }
    return icon;
  };

  return (
    <div className={`${styles.dashboardContainer} ${className || ''}`.trim()} data-testid="dashboard-layout">
      {/* Hero Banner Area */}
      <section className={styles.heroBanner} aria-label="Dashboard Overview">
        <div className={styles.heroLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {badge ? (
              badge
            ) : (
              <span className={styles.industryBadge}>
                {tenant.identity.displayName} • {tenant.industry.toUpperCase()}
              </span>
            )}
          </div>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        {actions && <div className={styles.heroActions}>{actions}</div>}
      </section>

      {/* KPI Stat Cards Ribbon */}
      {metrics && metrics.length > 0 && (
        <section className={styles.kpiRibbon} aria-label="Key Performance Indicators">
          <div className={styles.kpiGrid}>
            {metrics.map((metric) => {
              const changeType = metric.changeType || 'neutral';
              return (
                <div key={metric.id} className={styles.kpiCard} data-testid={`kpi-card-${metric.id}`}>
                  <div className={styles.kpiTopRow}>
                    <span className={styles.kpiTitle}>{metric.title}</span>
                    <div className={styles.kpiIconWrapper} aria-hidden="true">
                      {renderMetricIcon(metric.icon)}
                    </div>
                  </div>

                  <div className={styles.kpiValueRow}>
                    <span className={styles.kpiValue}>{metric.value}</span>
                  </div>

                  {(metric.change || metric.description) && (
                    <div className={styles.kpiBottomRow}>
                      {metric.change && (
                        <span
                          className={`${styles.changeBadge} ${
                            styles[`change_${changeType}`]
                          }`}
                        >
                          {changeType === 'positive' && <TrendingUp size={12} aria-hidden="true" />}
                          {changeType === 'negative' && <TrendingDown size={12} aria-hidden="true" />}
                          {changeType === 'neutral' && <Minus size={12} aria-hidden="true" />}
                          <span>{metric.change}</span>
                        </span>
                      )}
                      {metric.description && (
                        <span className={styles.kpiDesc}>{metric.description}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Responsive Children / Widget Grid Slot */}
      {children && <div className={styles.widgetGrid}>{children}</div>}
    </div>
  );
};
