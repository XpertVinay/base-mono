import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Shield, Globe, Palette, Sliders } from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import styles from './SettingsPage.module.css';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant } = useTenant();

  return (
    <div className={styles.container}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </div>

      <div className={styles.grid}>
        {/* Identity & Legal */}
        <Card>
          <CardHeader
            title={t('settings.tenantDetails')}
            subtitle="Organization identifier and legal registration"
            action={<Badge variant="primary">{tenant.industry}</Badge>}
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div className={styles.tokenRow}>
                <span>Tenant Slug</span>
                <code style={{ color: 'var(--color-primary)' }}>{tenant.identity.slug}</code>
              </div>
              <div className={styles.tokenRow}>
                <span>Tenant ID</span>
                <code>{tenant.identity.id}</code>
              </div>
              <div className={styles.tokenRow}>
                <span>Display Name</span>
                <strong>{tenant.identity.displayName}</strong>
              </div>
              <div className={styles.tokenRow}>
                <span>Legal Entity</span>
                <span>{tenant.identity.legalName}</span>
              </div>
              <div className={styles.tokenRow}>
                <span>Support Email</span>
                <span>{tenant.identity.supportEmail}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Live CSS Branding Tokens */}
        <Card>
          <CardHeader
            title={t('settings.brandingTokens')}
            subtitle="Dynamic CSS Custom Properties injected into :root"
            action={<Palette size={18} style={{ color: 'var(--color-primary)' }} />}
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div className={styles.tokenRow}>
                <span>--color-primary</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code>{tenant.branding.primaryColor}</code>
                  <div
                    className={styles.colorSwatch}
                    style={{ backgroundColor: tenant.branding.primaryColor }}
                  />
                </div>
              </div>
              <div className={styles.tokenRow}>
                <span>--color-secondary</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code>{tenant.branding.secondaryColor}</code>
                  <div
                    className={styles.colorSwatch}
                    style={{ backgroundColor: tenant.branding.secondaryColor }}
                  />
                </div>
              </div>
              <div className={styles.tokenRow}>
                <span>--color-accent</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code>{tenant.branding.accentColor}</code>
                  <div
                    className={styles.colorSwatch}
                    style={{ backgroundColor: tenant.branding.accentColor }}
                  />
                </div>
              </div>
              <div className={styles.tokenRow}>
                <span>--color-surface</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code>{tenant.branding.surfaceColor}</code>
                  <div
                    className={styles.colorSwatch}
                    style={{ backgroundColor: tenant.branding.surfaceColor }}
                  />
                </div>
              </div>
              <div className={styles.tokenRow}>
                <span>--font-family</span>
                <span style={{ fontSize: '0.75rem' }}>{tenant.branding.fontFamily}</span>
              </div>
              <div className={styles.tokenRow}>
                <span>--radius-md</span>
                <code>{tenant.branding.borderRadius}</code>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Localization & Formatting */}
        <Card>
          <CardHeader
            title={t('settings.localizationSettings')}
            subtitle="Locale formatting, currency and time parameters"
            action={<Globe size={18} style={{ color: 'var(--color-secondary)' }} />}
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div className={styles.tokenRow}>
                <span>Default Locale</span>
                <strong>{tenant.localization.defaultLocale}</strong>
              </div>
              <div className={styles.tokenRow}>
                <span>Supported Locales</span>
                <span>{tenant.localization.supportedLocales.join(', ')}</span>
              </div>
              <div className={styles.tokenRow}>
                <span>Default Currency</span>
                <Badge variant="primary">{tenant.localization.currencyCode}</Badge>
              </div>
              <div className={styles.tokenRow}>
                <span>Default Timezone</span>
                <span>{tenant.localization.defaultTimeZone}</span>
              </div>
              <div className={styles.tokenRow}>
                <span>Time Format</span>
                <span>{tenant.localization.timeFormat.toUpperCase()}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Runtime & Security Isolation */}
        <Card>
          <CardHeader
            title="Runtime & Security Isolation"
            subtitle="Backend origin trust boundaries and authentication mode"
            action={<Shield size={18} style={{ color: 'var(--color-success)' }} />}
          />
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div className={styles.tokenRow}>
                <span>API Gateway Target</span>
                <code>{tenant.runtime.apiBaseUrl}</code>
              </div>
              <div className={styles.tokenRow}>
                <span>Auth Protocol</span>
                <Badge variant="success">{tenant.runtime.authMode.toUpperCase()}</Badge>
              </div>
              <div className={styles.tokenRow}>
                <span>Session Timeout</span>
                <span>{tenant.runtime.sessionTimeoutMinutes} minutes</span>
              </div>
              <div className={styles.tokenRow}>
                <span>Multi-Tenant Header</span>
                <code>X-Tenant-ID: {tenant.identity.id}</code>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Enabled Features Matrix */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <CardHeader
            title={t('settings.featuresList')}
            subtitle="Platform capability flags activated for this tenant"
            action={<Sliders size={18} style={{ color: 'var(--color-accent)' }} />}
          />
          <CardBody>
            <div className={styles.featureList}>
              {Object.entries(tenant.features.enabledFeatures).map(([featureKey, enabled]) => (
                <div key={featureKey} className={styles.featureCard}>
                  <span style={{ fontWeight: 500 }}>{featureKey}</span>
                  {enabled ? (
                    <Badge variant="success">
                      <Check size={12} /> Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral">
                      <X size={12} /> Disabled
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
