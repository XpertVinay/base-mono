import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Database,
  Truck,
  Coins,
  BarChart3,
  LineChart,
  TrendingUp,
  Settings,
  Layers,
  LogOut,
  Menu,
  X,
  ExternalLink,
  LucideIcon,
} from 'lucide-react';
import { useTenant } from '../core/tenant/TenantContext';
import { useAuthStore } from '../core/auth/authStore';
import { DevTenantSwitcher } from '../core/tenant/DevTenantSwitcher';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { TenantLogo } from '../components/common/TenantLogo';
import styles from './AppLayout.module.css';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Database,
  Truck,
  Coins,
  BarChart3,
  LineChart,
  TrendingUp,
  Settings,
};

export const AppLayout: React.FC = () => {
  const { t } = useTranslation();
  const { tenant, isFeatureEnabled } = useTenant();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navigation items by enabled features and user roles
  const filteredNavItems = tenant.features.navigationItems.filter((item) => {
    if (item.requiredFeature && !isFeatureEnabled(item.requiredFeature)) {
      return false;
    }
    if (item.roles && user && !item.roles.includes(user.role)) {
      return false;
    }
    return true;
  });

  return (
    <div className={styles.appContainer}>
      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} ${mobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <TenantLogo size={32} showText={true} />
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className={styles.navSection} aria-label="Tenant Navigation">
          {filteredNavItems.map((item) => {
            const IconComponent = ICON_MAP[item.icon] || Layers;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`
                }
              >
                <IconComponent size={18} className={styles.navIcon} />
                <span>{t(item.labelKey, item.key)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar User / Footer */}
        {user && (
          <div className={styles.sidebarFooter}>
            <div className={styles.userInfo}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className={styles.avatar} />
              ) : (
                <div className={styles.avatar} />
              )}
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.userRole}>{user.role}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={t('common.logout')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Workspace */}
      <div className={styles.mainWrapper}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: 'none',
                border: 'none',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
              className="mobileToggleBtn"
            >
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
                {tenant.identity.displayName}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                {t('common.systemOnline')} • {tenant.localization.defaultTimeZone}
              </span>
            </div>
          </div>

          <div className={styles.headerRight}>
            <DevTenantSwitcher />
            <LanguageSwitcher />
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <div>
            &copy; {new Date().getFullYear()} {tenant.identity.legalName}. All rights reserved.
          </div>
          <div className={styles.footerLinks}>
            <a href={tenant.identity.supportUrl} target="_blank" rel="noreferrer" className={styles.footerLink}>
              Support <ExternalLink size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
            </a>
            <a href={tenant.identity.termsUrl} target="_blank" rel="noreferrer" className={styles.footerLink}>
              Terms
            </a>
            <a href={tenant.identity.privacyUrl} target="_blank" rel="noreferrer" className={styles.footerLink}>
              Privacy
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};
