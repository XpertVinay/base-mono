import React, { useState, useRef, useEffect, useContext } from 'react';
import { Shield, Check, ChevronsUpDown } from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { normalizeRole } from '../../core/auth/rbac';
import { TenantContext } from '../../core/tenant/TenantContext';
import styles from './RoleSwitcher.module.css';

export type EnterpriseRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'SUPPORT' | 'CUSTOMER';

export interface RoleSwitcherProps {
  className?: string;
  onRoleChange?: (role: EnterpriseRole) => void;
}

interface RoleOption {
  role: EnterpriseRole;
  label: string;
  badgeVariant: 'primary' | 'secondary' | 'warning' | 'success';
  description: string;
}

export const ROLES: RoleOption[] = [
  {
    role: 'SUPER_ADMIN',
    label: 'Super Admin',
    badgeVariant: 'primary',
    description: 'Platform-wide oversight across all tenants and infrastructure',
  },
  {
    role: 'TENANT_ADMIN',
    label: 'Tenant Admin',
    badgeVariant: 'secondary',
    description: 'Tenant administration, members, and custom role bindings',
  },
  {
    role: 'SUPPORT',
    label: 'Support',
    badgeVariant: 'warning',
    description: 'Tenant-scoped customer troubleshooting workbench without admin leakage',
  },
  {
    role: 'CUSTOMER',
    label: 'Customer',
    badgeVariant: 'success',
    description: 'Self-service client portal for orders, receipts, and personal assets',
  },
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ className, onRoleChange }) => {
  const { user, setUser } = useAuthStore();
  const tenantCtx = useContext(TenantContext);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize current role to 4 enterprise tiers
  const getActiveEnterpriseRole = (): EnterpriseRole => {
    if (!user) return 'TENANT_ADMIN';
    const roleStr = String(user.role).toUpperCase();
    if (roleStr === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (roleStr === 'TENANT_ADMIN') return 'TENANT_ADMIN';
    if (roleStr === 'SUPPORT') return 'SUPPORT';
    if (roleStr === 'CUSTOMER') return 'CUSTOMER';

    const normalized = normalizeRole(user.role);
    if (normalized === 'ADMIN') {
      return !user.tenantId || user.tenantId === 'default' ? 'SUPER_ADMIN' : 'TENANT_ADMIN';
    }
    if (normalized === 'SUPPORT') return 'SUPPORT';
    return 'CUSTOMER';
  };

  const currentRole = getActiveEnterpriseRole();
  const currentOption = ROLES.find((r) => r.role === currentRole) ?? ROLES[1]!;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const handleRoleSelect = (newRole: EnterpriseRole) => {
    let storeRole: string = newRole;
    const activeTenantId = tenantCtx?.tenant?.identity?.id || 'ten_apex_health_01';
    const activeTenantSlug = tenantCtx?.tenantSlug || 'apex-health';
    let tenantId = user?.tenantId || activeTenantId;

    if (newRole === 'SUPER_ADMIN') {
      storeRole = 'ADMIN';
      tenantId = 'default';
    } else {
      // Switching to a tenant-scoped role (TENANT_ADMIN, SUPPORT, CUSTOMER).
      // If current tenant is 'default' (from platform admin), restore to active tenant context.
      if (tenantId === 'default') {
        tenantId = activeTenantId;
      }

      if (newRole === 'TENANT_ADMIN') {
        storeRole = 'ADMIN';
      } else if (newRole === 'SUPPORT') {
        storeRole = 'SUPPORT';
      } else if (newRole === 'CUSTOMER') {
        storeRole = 'USER';
      }
    }

    const tenantSlug = tenantId === 'default' ? undefined : (user?.tenantSlug || activeTenantSlug);

    if (user) {
      setUser({
        ...user,
        role: storeRole as any,
        tenantId,
        ...(tenantSlug !== undefined ? { tenantSlug } : {}),
      });
    } else {
      setUser({
        id: 'sim_usr_preview',
        name: 'Preview User',
        email: 'preview@enterprise.local',
        role: storeRole as any,
        tenantId,
        ...(tenantSlug !== undefined ? { tenantSlug } : {}),
        isActive: true,
      });
    }

    onRoleChange?.(newRole);
    setIsOpen(false);
  };

  return (
    <div
      className={`${styles.wrapper} ${className || ''}`.trim()}
      ref={containerRef}
      data-testid="role-switcher"
    >
      <button
        type="button"
        className={`${styles.roleButton} ${styles[`role_${currentOption.badgeVariant}`]}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Simulate Role Preview (RBAC)"
        title="Simulate Role Preview (RBAC)"
      >
        <Shield size={14} className={styles.shieldIcon} aria-hidden="true" />
        <span className={styles.roleLabel}>{currentOption.label}</span>
        <ChevronsUpDown size={12} className={styles.chevron} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox" aria-label="Simulate Role">
          <div className={styles.header}>
            <Shield size={13} aria-hidden="true" />
            <span>RBAC Preview Simulator</span>
          </div>
          <div className={styles.list}>
            {ROLES.map((item) => {
              const isActive = item.role === currentRole;
              return (
                <button
                  key={item.role}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                  onClick={() => handleRoleSelect(item.role)}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{item.label}</span>
                    {isActive && <Check size={14} className={styles.checkIcon} aria-label="Active" />}
                  </div>
                  <p className={styles.itemDesc}>{item.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
