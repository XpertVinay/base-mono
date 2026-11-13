import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  Layers,
  LogOut,
  Shield,
  Building2,
  ChevronsUpDown,
} from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import { normalizeRole } from '../../core/auth/rbac';
import { UserRole } from '../../core/auth/types';
import {
  getFilteredNavGroups,
  isNavItemActive,
  NAV_ICON_MAP,
  NavBadgeVariant,
} from '../../core/navigation/navConfig';
import styles from './SidebarNav.module.css';

interface SidebarNavProps {
  onItemClick?: () => void;
}

const STORAGE_EXPANDED_GROUPS_KEY = 'enterprise_sidebar_open_groups';

export const SidebarNav: React.FC<SidebarNavProps> = ({ onItemClick }) => {
  const { t } = useTranslation();
  const { tenant, isFeatureEnabled } = useTenant();
  const { user, setUser, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Compute filtered groups based on active tenant, user role & feature gates
  const filteredGroups = getFilteredNavGroups({
    user,
    tenant,
    isFeatureEnabled,
  });

  // Track expanded/collapsed state for each navigation group
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_EXPANDED_GROUPS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback if parsing fails
    }
    // Default: expand all groups initially
    const initial: Record<string, boolean> = {};
    for (const group of filteredGroups) {
      initial[group.id] = group.defaultExpanded ?? true;
    }
    return initial;
  });

  // Keep state synced with localStorage
  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(STORAGE_EXPANDED_GROUPS_KEY, JSON.stringify(next));
      } catch {
        // LocalStorage write ignored
      }
      return next;
    });
  };

  // Automatically expand the group containing the currently active item
  useEffect(() => {
    for (const group of filteredGroups) {
      const hasActiveChild = group.items.some((item) =>
        isNavItemActive(item.path, location.pathname, location.search, item.exact)
      );
      if (hasActiveChild) {
        setOpenGroups((prev) => {
          if (prev[group.id]) return prev;
          const next = { ...prev, [group.id]: true };
          try {
            localStorage.setItem(STORAGE_EXPANDED_GROUPS_KEY, JSON.stringify(next));
          } catch {
            // Ignore
          }
          return next;
        });
      }
    }
  }, [location.pathname, location.search, filteredGroups]);

  const handleLogout = async () => {
    const slo = await logout({
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
    if (slo?.idpLogoutUrl) {
      window.location.href = slo.idpLogoutUrl;
      return;
    }
    navigate('/login');
  };

  const handleRoleSimulation = (role: UserRole) => {
    if (user) {
      setUser({
        ...user,
        role,
      });
    }
  };

  const getBadgeClass = (variant?: NavBadgeVariant) => {
    switch (variant) {
      case 'primary':
        return styles.badgePrimary;
      case 'success':
        return styles.badgeSuccess;
      case 'warning':
        return styles.badgeWarning;
      case 'danger':
        return styles.badgeDanger;
      case 'neutral':
      default:
        return styles.badgeNeutral;
    }
  };

  const currentRole = normalizeRole(user?.role);

  return (
    <div className={styles.sidebarNavContainer}>
      {/* Workspace Switcher Pill (Stitch Desktop Shell) */}
      <div className={styles.workspaceCard} title={`Active Workspace: ${tenant.identity.displayName}`}>
        <div className={styles.workspaceLeft}>
          <Building2 size={18} className={styles.workspaceIcon} />
          <div className={styles.workspaceMeta}>
            <span className={styles.workspaceLabel}>Workspace</span>
            <span className={styles.workspaceName}>{tenant.identity.displayName}</span>
          </div>
        </div>
        <ChevronsUpDown size={14} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
      </div>

      {/* Scrollable Navigation Groups */}
      <nav className={styles.scrollArea} aria-label={t('nav.title', 'Enterprise Navigation')}>
        {filteredGroups.map((group) => {
          const isOpen = openGroups[group.id] ?? true;
          const GroupIconComponent = NAV_ICON_MAP[group.icon] || Layers;
          const isAnyChildActive = group.items.some((item) =>
            isNavItemActive(item.path, location.pathname, location.search, item.exact)
          );

          return (
            <div key={group.id} className={styles.navGroup}>
              {/* Group Collapsible Header */}
              <button
                type="button"
                className={`${styles.navGroupHeader} ${
                  isAnyChildActive ? styles.navGroupHeaderActive : ''
                }`}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`group-${group.id}`}
                title={t(group.titleKey, group.defaultTitle)}
              >
                <div className={styles.groupLeft}>
                  <GroupIconComponent size={14} className={styles.groupIcon} />
                  <span className={styles.groupTitle}>
                    {t(group.titleKey, group.defaultTitle)}
                  </span>
                </div>

                <div className={styles.groupRight}>
                  {group.badge && (
                    <span
                      className={`${styles.rbacBadge} ${getBadgeClass(
                        group.badgeVariant
                      )}`}
                    >
                      {t(`nav.badges.${group.badge.toLowerCase()}`, group.badge)}
                    </span>
                  )}
                  <ChevronRight
                    size={13}
                    className={`${styles.chevron} ${
                      isOpen ? styles.chevronExpanded : ''
                    }`}
                  />
                </div>
              </button>

              {/* Group Child Items */}
              <div
                id={`group-${group.id}`}
                className={`${styles.groupItems} ${
                  !isOpen ? styles.groupItemsCollapsed : ''
                }`}
              >
                {group.items.map((item) => {
                  const IconComponent = NAV_ICON_MAP[item.icon] || Layers;
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
                      onClick={() => onItemClick?.()}
                      className={`${styles.navItemLink} ${
                        isActive ? styles.itemActive : ''
                      }`}
                      title={item.description || item.defaultLabel}
                    >
                      <div className={styles.itemContent}>
                        <IconComponent size={15} className={styles.itemIcon} />
                        <span className={styles.itemLabel}>
                          {t(item.labelKey, item.defaultLabel)}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          className={`${styles.rbacBadge} ${getBadgeClass(
                            item.badgeVariant
                          )}`}
                        >
                          {t(`nav.badges.${item.badge.toLowerCase()}`, item.badge)}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer with Layered RBAC Simulator */}
      {user && (
        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.userInfo}>
              <div className={styles.avatarWrapper}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className={styles.avatar} />
                ) : (
                  <div className={styles.avatar}>
                    {user.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
                  </div>
                )}
                <span className={styles.presenceDot} />
              </div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{user.name}</span>
                <span className={styles.roleTag}>
                  {user.role} • {user.tenantId || 'default'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title={t('common.logout', 'Sign Out')}
              className={styles.logoutBtn}
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Interactive RBAC Role Preview Simulator */}
          <div className={styles.roleSimulatorBox}>
            <div className={styles.simulatorHeader}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={11} /> {t('nav.roleSimulator.title', 'RBAC Preview')}
              </span>
              <span>{currentRole}</span>
            </div>

            <div className={styles.roleButtons} role="group" aria-label="Simulate RBAC role">
              <button
                type="button"
                className={`${styles.roleSelectBtn} ${
                  currentRole === 'ADMIN' ? styles.roleSelectBtnActive : ''
                }`}
                onClick={() => handleRoleSimulation('ADMIN')}
                title="Simulate Admin Role (Full Access)"
              >
                ADMIN
              </button>
              <button
                type="button"
                className={`${styles.roleSelectBtn} ${
                  currentRole === 'SUPPORT' ? styles.roleSelectBtnActive : ''
                }`}
                onClick={() => handleRoleSimulation('SUPPORT')}
                title="Simulate Support Role (Operator Access)"
              >
                SUPPORT
              </button>
              <button
                type="button"
                className={`${styles.roleSelectBtn} ${
                  currentRole === 'USER' ? styles.roleSelectBtnActive : ''
                }`}
                onClick={() => handleRoleSimulation('USER')}
                title="Simulate User Role (Restricted Access)"
              >
                USER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
