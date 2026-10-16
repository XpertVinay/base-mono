import React from 'react';
import { Outlet } from 'react-router-dom';
import { DevTenantSwitcher } from '../core/tenant/DevTenantSwitcher';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { TenantLogo } from '../components/common/TenantLogo';
import { useTenant } from '../core/tenant/TenantContext';
import styles from './AuthLayout.module.css';

export const AuthLayout: React.FC = () => {
  const { tenant } = useTenant();

  return (
    <div className={styles.container}>
      <div className={styles.gradientGlow} />

      <div className={styles.topBar}>
        <DevTenantSwitcher />
        <LanguageSwitcher />
      </div>

      <div className={styles.authCard}>
        <div className={styles.brandHeader}>
          <TenantLogo size={48} showText={false} />
          <h1
            style={{
              fontSize: 'var(--font-size-2xl)',
              marginTop: 'var(--spacing-md)',
              color: 'var(--color-text)',
            }}
          >
            {tenant.identity.displayName}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            {tenant.identity.legalName}
          </p>
        </div>

        <Outlet />
      </div>

      <div className={styles.footer}>
        &copy; {new Date().getFullYear()} {tenant.identity.legalName}. Enterprise Portal Security.
      </div>
    </div>
  );
};
