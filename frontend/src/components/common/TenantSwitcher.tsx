import React, { useState, useRef, useEffect } from 'react';
import { Building2, Check, ChevronsUpDown, Globe } from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import styles from './TenantSwitcher.module.css';

export interface TenantSwitcherProps {
  className?: string;
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ className }) => {
  const { tenant, tenantSlug, availableTenants, switchTenant } = useTenant();
  const { user, setUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (slug: string) => {
    switchTenant(slug);
    if (user) {
      const selectedTenant = availableTenants.find((t) => t.identity.slug === slug);
      if (selectedTenant) {
        setUser({
          ...user,
          tenantId: selectedTenant.identity.id,
          tenantSlug: selectedTenant.identity.slug,
        });
      }
    }
    setIsOpen(false);
  };

  return (
    <div
      className={`${styles.switcherWrapper} ${className || ''}`.trim()}
      ref={containerRef}
      data-testid="tenant-switcher"
    >
      <button
        type="button"
        className={styles.triggerBtn}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Switch Workspace / Tenant"
        title="Switch Workspace / Tenant"
      >
        <div className={styles.triggerLeft}>
          <Building2 size={16} className={styles.buildingIcon} aria-hidden="true" />
          <div className={styles.triggerInfo}>
            <span className={styles.tenantName}>{tenant.identity.displayName}</span>
            <span className={styles.industryTag}>{tenant.industry.toUpperCase()}</span>
          </div>
        </div>
        <ChevronsUpDown size={14} className={styles.chevronIcon} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu} role="listbox" aria-label="Available Tenants">
          <div className={styles.dropdownHeader}>
            <Globe size={13} aria-hidden="true" />
            <span>Select Workspace Tenant</span>
          </div>
          <div className={styles.tenantList}>
            {availableTenants.map((t) => {
              const isActive = t.identity.slug === tenantSlug;
              return (
                <button
                  key={t.identity.slug}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.tenantItem} ${isActive ? styles.tenantItemActive : ''}`}
                  onClick={() => handleSelect(t.identity.slug)}
                >
                  <div
                    className={styles.avatarCircle}
                    style={{ backgroundColor: t.branding.primaryColor || 'var(--color-primary)' }}
                    aria-hidden="true"
                  >
                    {t.identity.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.itemMeta}>
                    <span className={styles.itemTitle}>{t.identity.displayName}</span>
                    <span className={styles.itemSub}>
                      {t.identity.slug} &bull; {t.industry}
                    </span>
                  </div>
                  {isActive && <Check size={16} className={styles.checkIcon} aria-label="Selected" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
