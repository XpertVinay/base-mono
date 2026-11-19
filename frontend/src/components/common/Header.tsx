import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  HelpCircle,
  Command,
  Activity,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import { useApiTrafficStore } from '../../core/api/trafficStore';
import { TenantSwitcher } from './TenantSwitcher';
import { RoleSwitcher } from './RoleSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import styles from './Header.module.css';

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  isSidebarCollapsed = false,
  onToggleSidebar,
  children,
  className,
}) => {
  const { tenant } = useTenant();
  const { user } = useAuthStore();
  const { toggleDrawer, records } = useApiTrafficStore();
  const [searchQuery, setSearchQuery] = useState('');

  const userDisplayName = user?.name || 'Workspace User';
  const userInitials = userDisplayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className={`${styles.header} ${className || ''}`.trim()} role="banner">
      <div className={styles.headerLeft}>
        {/* Mobile Hamburger Menu Toggle */}
        {onToggleMobileMenu && (
          <button
            type="button"
            className={styles.mobileToggleBtn}
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Desktop Sidebar Rail Toggle */}
        {onToggleSidebar && (
          <button
            type="button"
            className={styles.desktopToggleBtn}
            onClick={onToggleSidebar}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

        {/* Live Tenant Status Pill */}
        <div
          className={styles.tenantStatusPill}
          title={`${tenant.identity.displayName} (${tenant.industry})`}
        >
          <span className={styles.statusLiveDot} aria-hidden="true" />
          <span className={styles.statusText}>{tenant.identity.displayName}</span>
          <span className={styles.statusDivider}>•</span>
          <span className={styles.statusSubtext}>{tenant.industry.toUpperCase()}</span>
        </div>

        {/* Global Search Bar */}
        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search portal, entities, docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search portal, entities, docs"
          />
          <div className={styles.searchKbd} aria-hidden="true">
            <Command size={11} />
            <span>K</span>
          </div>
        </div>
      </div>

      <div className={styles.headerRight}>
        {children}

        {/* API Traffic Inspector Trigger */}
        <button
          type="button"
          className={styles.iconBtn}
          title={`API Traffic Inspector (${records.length} captured calls)`}
          aria-label="API Traffic Inspector"
          onClick={toggleDrawer}
        >
          <Activity size={18} className={styles.activityIcon} />
          {records.length > 0 && (
            <span className={styles.trafficBadge}>{records.length}</span>
          )}
        </button>

        {/* Notification Bell */}
        <button
          type="button"
          className={styles.iconBtn}
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className={styles.notificationDot} aria-hidden="true" />
        </button>

        {/* Help & Documentation */}
        <button
          type="button"
          className={styles.iconBtn}
          title="Documentation & Help"
          aria-label="Documentation"
          onClick={() => {
            if (tenant.identity.supportUrl) {
              window.open(tenant.identity.supportUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          <HelpCircle size={18} />
        </button>

        <div className={styles.divider} aria-hidden="true" />

        {/* Enterprise Tenant Switcher */}
        <TenantSwitcher />

        {/* RBAC Role Simulator Switcher */}
        <RoleSwitcher />

        {/* Language Selector */}
        <LanguageSwitcher />

        {/* User Profile Avatar Pill */}
        <div className={styles.userProfilePill} title={userDisplayName}>
          <div className={styles.userAvatarSmall}>{userInitials}</div>
        </div>
      </div>
    </header>
  );
};
