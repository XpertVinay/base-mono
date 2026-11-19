import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  PanelLeftClose,
  PanelLeft,
  X,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import { TenantLogo } from './TenantLogo';
import {
  getFilteredNavGroups,
  isNavItemActive,
  NAV_ICON_MAP,
} from '../../core/navigation/navConfig';
import styles from './Sidebar.module.css';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  className,
}) => {
  const { tenant, isFeatureEnabled } = useTenant();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredGroups = getFilteredNavGroups({
    user,
    tenant,
    isFeatureEnabled,
  });

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Ignored
    }
    navigate('/login');
  };

  const handleNavClick = () => {
    if (mobileOpen) {
      onCloseMobile();
    }
  };

  const userDisplayName = user?.name || 'Workspace User';
  const userInitials = userDisplayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const userRole = String(user?.role || 'USER').toUpperCase();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={onCloseMobile}
          aria-hidden="true"
          data-testid="sidebar-backdrop"
        />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${
          mobileOpen ? styles.mobileOpen : ''
        } ${className || ''}`.trim()}
        role="navigation"
        aria-label="Main Navigation"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-mobile-open={mobileOpen ? 'true' : 'false'}
      >
        {/* Sidebar Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.brandWrapper}>
            <TenantLogo size={32} showText={!collapsed} />
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              className={styles.collapseToggleBtn}
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar (260px)' : 'Collapse sidebar (72px rail)'}
            >
              {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}

          {/* Mobile Close Button */}
          {mobileOpen && (
            <button
              type="button"
              className={styles.mobileCloseBtn}
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Groups & Links */}
        <div className={styles.scrollArea}>
          {filteredGroups.map((group) => (
            <div key={group.id} className={styles.navGroup}>
              {!collapsed && (
                <div className={styles.groupHeader}>
                  <span>{group.defaultTitle}</span>
                </div>
              )}

              <div className={styles.groupItems}>
                {group.items.map((item) => {
                  const IconComponent = NAV_ICON_MAP[item.icon] || LayoutDashboard;
                  const isActive = isNavItemActive(
                    item.path,
                    location.pathname,
                    location.search,
                    item.exact
                  );

                  return (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      onClick={handleNavClick}
                      className={({ isActive: navActive }) =>
                        `${styles.navItem} ${isActive || navActive ? styles.navItemActive : ''}`
                      }
                      title={collapsed ? item.defaultLabel : undefined}
                      aria-label={item.defaultLabel}
                    >
                      <span className={styles.iconWrapper} aria-hidden="true">
                        <IconComponent size={18} />
                      </span>

                      {!collapsed && (
                        <>
                          <span className={styles.itemLabel}>{item.defaultLabel}</span>
                          {item.badge && (
                            <span
                              className={`${styles.itemBadge} ${
                                styles[`badge_${item.badgeVariant || 'neutral'}`]
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: User profile & Logout */}
        <div className={styles.sidebarFooter}>
          {!collapsed ? (
            <div className={styles.userExpanded}>
              <div className={styles.userAvatar}>{userInitials}</div>
              <div className={styles.userMeta}>
                <span className={styles.userName} title={userDisplayName}>
                  {userDisplayName}
                </span>
                <span className={styles.userRoleTag}>{userRole}</span>
              </div>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={handleLogout}
                aria-label="Logout"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.userCollapsed}>
              <div
                className={styles.userAvatar}
                title={`${userDisplayName} (${userRole})`}
              >
                {userInitials}
              </div>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={handleLogout}
                aria-label="Logout"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
