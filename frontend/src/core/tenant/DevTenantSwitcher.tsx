import React from 'react';
import { useTenant } from './TenantContext';
import styles from './DevTenantSwitcher.module.css';

export const DevTenantSwitcher: React.FC = () => {
  const { tenantSlug, availableTenants, switchTenant } = useTenant();

  return (
    <div className={styles.switcherContainer} title="Development Multi-Tenant Switcher">
      <span className={styles.devBadge}>Dev Tenant</span>
      <select
        value={tenantSlug}
        onChange={(e) => switchTenant(e.target.value)}
        className={styles.select}
        aria-label="Switch Tenant"
      >
        {availableTenants.map((t) => (
          <option key={t.identity.slug} value={t.identity.slug}>
            {t.identity.displayName} ({t.industry})
          </option>
        ))}
      </select>
    </div>
  );
};
