import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Menu,
  X,
  ExternalLink,
  Search,
  Bell,
  HelpCircle,
  Command,
} from 'lucide-react';
import { useTenant } from '../core/tenant/TenantContext';
import { DevTenantSwitcher } from '../core/tenant/DevTenantSwitcher';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { TenantLogo } from '../components/common/TenantLogo';
import { SidebarNav } from '../components/navigation/SidebarNav';
import styles from './AppLayout.module.css';

export const AppLayout: React.FC = () => {
  const { tenant } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <SidebarNav onItemClick={() => setMobileMenuOpen(false)} />
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
              aria-label="Toggle navigation menu"
            >
              <Menu size={20} />
            </button>

            <div className={styles.tenantStatusPill} title={`${tenant.identity.displayName} (${tenant.industry})`}>
              <span className={styles.statusLiveDot} />
              <span className={styles.statusText}>{tenant.identity.displayName}</span>
              <span className={styles.statusDivider}>•</span>
              <span className={styles.statusSubtext}>{tenant.industry.toUpperCase()}</span>
            </div>

            {/* Global Search Bar */}
            <div className={styles.searchBar}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search portal, entities, docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className={styles.searchKbd}>
                <Command size={11} />
                <span>K</span>
              </div>
            </div>
          </div>

          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.iconBtn}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className={styles.notificationDot} />
            </button>

            <button
              type="button"
              className={styles.iconBtn}
              title="Documentation & Help"
              aria-label="Documentation"
              onClick={() => window.open(tenant.identity.supportUrl, '_blank')}
            >
              <HelpCircle size={18} />
            </button>

            <div className={styles.divider} />

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
