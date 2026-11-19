import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useTenant } from '../core/tenant/TenantContext';
import { Header } from '../components/common/Header';
import { Sidebar } from '../components/common/Sidebar';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { ApiTrafficInspector } from '../components/telemetry/ApiTrafficInspector';
import styles from './AppLayout.module.css';

export interface AppLayoutProps {
  children?: React.ReactNode;
}

const STORAGE_SIDEBAR_COLLAPSED_KEY = 'enterprise_sidebar_collapsed';

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { tenant } = useTenant();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_SIDEBAR_COLLAPSED_KEY) === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_SIDEBAR_COLLAPSED_KEY, String(next));
        } catch {
          // Ignore storage write issues
        }
      }
      return next;
    });
  };

  return (
    <div className={styles.appContainer} data-testid="app-layout">
      {/* Responsive Collapsible Navigation Sidebar */}
      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Workspace Column */}
      <div
        className={`${styles.mainWrapper} ${
          isSidebarCollapsed ? styles.mainWrapperCollapsed : ''
        }`}
      >
        {/* Top Navigation Bar with Controls */}
        <Header
          onToggleMobileMenu={() => setMobileOpen((prev) => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleCollapse}
        />

        {/* Dynamic Breadcrumbs Bar */}
        <div className={styles.breadcrumbsBar}>
          <Breadcrumbs />
        </div>

        {/* Primary Page Content Area */}
        <main className={styles.content} role="main">
          {children || <Outlet />}
        </main>

        {/* Enterprise Compliance & Legal Footer */}
        <footer className={styles.footer} role="contentinfo">
          <div>
            &copy; {new Date().getFullYear()} {tenant.identity.legalName}. All rights reserved.
          </div>
          <div className={styles.footerLinks}>
            {tenant.identity.supportUrl && (
              <a
                href={tenant.identity.supportUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.footerLink}
              >
                Support{' '}
                <ExternalLink
                  size={12}
                  style={{ display: 'inline', verticalAlign: 'middle' }}
                />
              </a>
            )}
            {tenant.identity.termsUrl && (
              <a
                href={tenant.identity.termsUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.footerLink}
              >
                Terms
              </a>
            )}
            {tenant.identity.privacyUrl && (
              <a
                href={tenant.identity.privacyUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.footerLink}
              >
                Privacy
              </a>
            )}
          </div>
        </footer>
      </div>

      {/* Global Interactive API Communication Inspector */}
      <ApiTrafficInspector />
    </div>
  );
};
