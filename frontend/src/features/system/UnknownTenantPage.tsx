import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { Button } from '../../components/ui/Button/Button';

export const UnknownTenantPage: React.FC = () => {
  const { t } = useTranslation();
  const { availableTenants, switchTenant, error } = useTenant();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b0f19',
        color: '#f8fafc',
        padding: 'var(--spacing-xl)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <AlertTriangle size={32} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
          {t('system.unknownTenantTitle')}
        </h1>

        <p
          style={{
            color: '#94a3b8',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          {t('system.unknownTenantDesc')}
        </p>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              fontSize: '0.75rem',
              color: '#fca5a5',
              fontFamily: 'monospace',
              marginBottom: '24px',
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        {/* Development recovery switcher */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '24px',
            borderTop: '1px solid #1f2937',
          }}
        >
          <p
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}
          >
            {t('system.switchDevTenant')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableTenants.map((t) => (
              <Button
                key={t.identity.slug}
                variant="secondary"
                size="md"
                onClick={() => {
                  switchTenant(t.identity.slug);
                  window.location.href = '/';
                }}
                rightIcon={<ArrowRight size={14} />}
                fullWidth
              >
                {t.identity.displayName} ({t.industry})
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
