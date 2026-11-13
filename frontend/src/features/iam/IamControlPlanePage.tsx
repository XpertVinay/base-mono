import React from 'react';
import {
  ShieldCheck,
  UserCheck,
  Activity,
  ArrowRightLeft,
  Link2,
  ServerCog,
  Building2,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';
import { normalizeRole } from '../../core/auth/rbac';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { ProfileAndAuthzTab } from './components/ProfileAndAuthzTab';
import { SsoSessionsTab } from './components/SsoSessionsTab';
import { SsoTokenToolsTab } from './components/SsoTokenToolsTab';
import { FederatedIdentitiesTab } from './components/FederatedIdentitiesTab';
import { OidcProvidersAdminTab } from './components/OidcProvidersAdminTab';
import { TenantsAdminTab } from './components/TenantsAdminTab';
import styles from './IamControlPlanePage.module.css';

type IamTabKey = 'profile' | 'sessions' | 'sso-tokens' | 'federated' | 'providers' | 'tenants';

const VALID_TABS: IamTabKey[] = ['profile', 'sessions', 'sso-tokens', 'federated', 'providers', 'tenants'];

export const IamControlPlanePage: React.FC = () => {
  const { user, connectionMode, sessionId, logout } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabQuery = searchParams.get('tab') as IamTabKey | null;
  const activeTab: IamTabKey = tabQuery && VALID_TABS.includes(tabQuery) ? tabQuery : 'profile';

  const handleTabChange = (tab: IamTabKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  const handleQuickSloLogout = async () => {
    const res = await logout({ postLogoutRedirectUri: `${window.location.origin}/login` });
    if (res?.idpLogoutUrl) {
      window.location.href = res.idpLogoutUrl;
    } else {
      navigate('/login');
    }
  };

  return (
    <div className={styles.container}>
      {/* Breadcrumb Navigation (Stitch Design) */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <span>Security</span>
        <ChevronRight size={13} className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbActive}>IAM Control Plane</span>
      </nav>

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Authentication, Authorization &amp; SSO Control Plane</h1>
          <p className={styles.subtitle}>
            Unified IAM, RBAC, Federated OIDC / OAuth2 / SAML, Service Token Exchange &amp; Single Logout
            via API &amp; gRPC Gateway (<code>:4000</code>)
          </p>
        </div>

        <div className={styles.headerBadges}>
          <Badge variant={connectionMode === 'live' ? 'success' : 'warning'} withDot>
            {connectionMode === 'live' ? 'Live Gateway' : 'Offline Demo'}
          </Badge>
          <Badge variant="primary">Role: {normalizeRole(user?.role)}</Badge>
          <Badge variant="neutral">Tenant: {user?.tenantId || 'default'}</Badge>
          {sessionId && <Badge variant="neutral">SID: {sessionId.slice(0, 10)}…</Badge>}
          <Button size="sm" variant="outline" onClick={handleQuickSloLogout} leftIcon={<LogOut size={14} />}>
            SLO Sign Out
          </Button>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist" aria-label="IAM and SSO management sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('profile')}
        >
          <UserCheck size={15} /> Profile, JWT &amp; RBAC
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sessions'}
          className={`${styles.tabBtn} ${activeTab === 'sessions' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('sessions')}
        >
          <Activity size={15} /> SSO Sessions &amp; SLO
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sso-tokens'}
          className={`${styles.tabBtn} ${activeTab === 'sso-tokens' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('sso-tokens')}
        >
          <ArrowRightLeft size={15} /> Handoff, Exchange &amp; Introspect
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'federated'}
          className={`${styles.tabBtn} ${activeTab === 'federated' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('federated')}
        >
          <Link2 size={15} /> Federated Links
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'providers'}
          className={`${styles.tabBtn} ${activeTab === 'providers' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('providers')}
        >
          <ServerCog size={15} /> OIDC / SAML Admin
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'tenants'}
          className={`${styles.tabBtn} ${activeTab === 'tenants' ? styles.tabBtnActive : ''}`}
          onClick={() => handleTabChange('tenants')}
        >
          <Building2 size={15} /> Multi-Tenancy &amp; Policies
        </button>
      </div>

      <div>
        {activeTab === 'profile' && <ProfileAndAuthzTab />}
        {activeTab === 'sessions' && <SsoSessionsTab />}
        {activeTab === 'sso-tokens' && <SsoTokenToolsTab />}
        {activeTab === 'federated' && <FederatedIdentitiesTab />}
        {activeTab === 'providers' && <OidcProvidersAdminTab />}
        {activeTab === 'tenants' && <TenantsAdminTab />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
        <ShieldCheck size={14} />
        <span>
          OpenAPI Specification Reference: <code>http://localhost:4000/api-docs/#</code>
        </span>
      </div>
    </div>
  );
};

