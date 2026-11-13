import React, { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Shield, PlusCircle } from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { isAdmin, isPlatformAdmin } from '../../../core/auth/rbac';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Select } from '../../../components/ui/Select/Select';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import { IamRole, MultiTenancyStatusDto, TenantDto } from '../../auth/types/iam.types';
import styles from '../IamControlPlanePage.module.css';

export const TenantsAdminTab: React.FC = () => {
  const { token, user, connectionMode } = useAuthStore();
  const userIsAdmin = isAdmin(user);
  const userIsPlatformAdmin = isPlatformAdmin(user);

  const [mtConfig, setMtConfig] = useState<MultiTenancyStatusDto | null>(null);
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [currentTenant, setCurrentTenant] = useState<TenantDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Policy Editor state
  const [allowLocalLogin, setAllowLocalLogin] = useState(true);
  const [allowFederatedLogin, setAllowFederatedLogin] = useState(true);
  const [autoProvisionUsers, setAutoProvisionUsers] = useState(true);
  const [defaultRole, setDefaultRole] = useState<IamRole>('USER');
  const [allowedEmailDomains, setAllowedEmailDomains] = useState('');
  const [sessionTtlSeconds, setSessionTtlSeconds] = useState('3600');

  // Onboard Tenant Wizard (Platform Admin)
  const [onboardSlug, setOnboardSlug] = useState('');
  const [onboardName, setOnboardName] = useState('');
  const [onboardAdminEmail, setOnboardAdminEmail] = useState('');
  const [onboardAdminPassword, setOnboardAdminPassword] = useState('');
  const [onboardAdminName, setOnboardAdminName] = useState('');

  const loadTenantsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mtRes = await iamApi.getMultiTenancyConfig({ tenantId: user?.tenantId });
      setMtConfig(mtRes.data);

      if (token && connectionMode === 'live') {
        const tenantId = user?.tenantId || 'default';
        const [oneRes, listRes] = await Promise.allSettled([
          iamApi.getTenant(tenantId, { token, tenantId }),
          userIsAdmin ? iamApi.listTenants({ token, tenantId }) : Promise.resolve(null),
        ]);

        if (oneRes.status === 'fulfilled') {
          const tData = oneRes.value.data;
          setCurrentTenant(tData);
          setAllowLocalLogin(tData.config.allowLocalLogin);
          setAllowFederatedLogin(tData.config.allowFederatedLogin);
          setAutoProvisionUsers(tData.config.autoProvisionUsers);
          setDefaultRole(tData.config.defaultRole);
          setAllowedEmailDomains((tData.config.allowedEmailDomains || []).join(', '));
          setSessionTtlSeconds(String(tData.config.sessionTtlSeconds || 3600));
        }

        if (listRes.status === 'fulfilled' && listRes.value) {
          setTenants(Array.isArray(listRes.value.data) ? listRes.value.data : []);
        }
      }
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to load tenant configuration');
    } finally {
      setLoading(false);
    }
  }, [token, user?.tenantId, connectionMode, userIsAdmin]);

  useEffect(() => {
    void loadTenantsData();
  }, [loadTenantsData]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !currentTenant) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await iamApi.updateTenant(
        currentTenant.id,
        {
          config: {
            allowLocalLogin,
            allowFederatedLogin,
            autoProvisionUsers,
            defaultRole,
            allowedEmailDomains: allowedEmailDomains
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean),
            sessionTtlSeconds: Number(sessionTtlSeconds) || 3600,
          },
        },
        { token, tenantId: user?.tenantId }
      );
      setCurrentTenant(res.data);
      setSuccessMsg(`Tenant '${res.data.slug}' auth & authorization policy updated.`);
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Policy update failed');
    }
  };

  const handleOnboardTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await iamApi.onboardTenant(
        {
          id: onboardSlug.trim().toLowerCase(),
          slug: onboardSlug.trim().toLowerCase(),
          name: onboardName.trim(),
          ...(onboardAdminEmail.trim()
            ? {
                adminUser: {
                  email: onboardAdminEmail.trim(),
                  password: onboardAdminPassword,
                  name: onboardAdminName.trim() || `${onboardName.trim()} Admin`,
                },
              }
            : {}),
        },
        { token, tenantId: user?.tenantId }
      );
      setSuccessMsg(
        `Tenant '${res.data.tenant.slug}' onboarded with ${res.data.inheritedProviders.length} inherited provider(s).`
      );
      setOnboardSlug('');
      setOnboardName('');
      setOnboardAdminEmail('');
      setOnboardAdminPassword('');
      setOnboardAdminName('');
      await loadTenantsData();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Tenant onboarding failed');
    }
  };

  return (
    <div className={styles.grid}>
      {/* Multi-Tenancy Status */}
      <Card>
        <CardHeader
          title="Multi-Tenancy Runtime Config"
          subtitle="GET /api/v1/iam/tenants/config"
          action={
            <Button size="sm" variant="secondary" isLoading={loading} onClick={loadTenantsData} leftIcon={<RefreshCw size={14} />}>
              Refresh
            </Button>
          }
        />
        <CardBody>
          {mtConfig ? (
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Multi-Tenancy Enabled</span>
                <Badge variant={mtConfig.enabled ? 'success' : 'neutral'}>
                  {mtConfig.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Enforcement Mode</span>
                <Badge variant="primary">{mtConfig.mode.toUpperCase()}</Badge>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Default Tenant ID</span>
                <code>{mtConfig.defaultTenantId}</code>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Headers</span>
                <code>
                  {mtConfig.tenantHeader}, {mtConfig.tenantSlugHeader}
                </code>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Subdomain Routing</span>
                <span>{mtConfig.subdomainEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>Gateway config unavailable.</div>
          )}
        </CardBody>
      </Card>

      {/* Tenant Auth Policy Editor */}
      <Card>
        <CardHeader
          title={`Tenant Auth Policy (${currentTenant?.slug || user?.tenantId || 'default'})`}
          subtitle="GET & PATCH /api/v1/iam/tenants/:idOrSlug"
          action={<Shield size={18} style={{ color: 'var(--color-primary)' }} />}
        />
        <CardBody>
          <form onSubmit={handleSavePolicy} className={styles.formStack}>
            {error && <Alert variant="error">{error}</Alert>}
            {successMsg && <Alert variant="success">{successMsg}</Alert>}

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={allowLocalLogin}
                onChange={(e) => setAllowLocalLogin(e.target.checked)}
                disabled={!userIsAdmin}
              />
              Allow Local Email/Password Login
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={allowFederatedLogin}
                onChange={(e) => setAllowFederatedLogin(e.target.checked)}
                disabled={!userIsAdmin}
              />
              Allow Federated OIDC / OAuth2 / SAML Login
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={autoProvisionUsers}
                onChange={(e) => setAutoProvisionUsers(e.target.checked)}
                disabled={!userIsAdmin}
              />
              JIT Auto-Provision Federated Users
            </label>

            <div className={styles.formRow}>
              <Select
                label="Default JIT Role"
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as IamRole)}
                disabled={!userIsAdmin}
                options={[
                  { value: 'USER', label: 'USER' },
                  { value: 'SUPPORT', label: 'SUPPORT' },
                  { value: 'ADMIN', label: 'ADMIN' },
                ]}
              />
              <Input
                label="Session TTL (seconds)"
                type="number"
                min={60}
                max={86400}
                value={sessionTtlSeconds}
                onChange={(e) => setSessionTtlSeconds(e.target.value)}
                disabled={!userIsAdmin}
              />
            </div>

            <Input
              label="Allowed Email Domains (comma-separated)"
              value={allowedEmailDomains}
              onChange={(e) => setAllowedEmailDomains(e.target.value)}
              placeholder="acme.com, partner.org"
              disabled={!userIsAdmin}
            />

            {userIsAdmin && (
              <Button type="submit" variant="primary" disabled={!currentTenant}>
                Save Tenant Policy
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      {/* Tenant Directory */}
      {userIsAdmin && (
        <Card>
          <CardHeader
            title="Registered IAM Tenants"
            subtitle="GET /api/v1/iam/tenants"
            action={<Building2 size={18} style={{ color: 'var(--color-secondary)' }} />}
          />
          <CardBody>
            {tenants.length === 0 ? (
              <div className={styles.emptyState}>No tenants returned.</div>
            ) : (
              <div className={styles.kvList}>
                {tenants.map((ten) => (
                  <div key={ten.id} className={styles.kvRow}>
                    <div>
                      <strong>{ten.name}</strong> (<code>{ten.slug}</code>)
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        Local: {ten.config.allowLocalLogin ? 'Yes' : 'No'} • Fed:{' '}
                        {ten.config.allowFederatedLogin ? 'Yes' : 'No'} • TTL: {ten.config.sessionTtlSeconds}s
                      </div>
                    </div>
                    <Badge variant={ten.isActive ? 'success' : 'error'}>
                      {ten.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Platform Admin Tenant Onboarding */}
      {userIsPlatformAdmin && (
        <Card>
          <CardHeader
            title="Platform Admin: Onboard Tenant"
            subtitle="POST /api/v1/iam/tenants/onboard — creates tenant, admin & inherits system IdPs"
            action={<PlusCircle size={18} style={{ color: 'var(--color-accent)' }} />}
          />
          <CardBody>
            <form onSubmit={handleOnboardTenant} className={styles.formStack}>
              <div className={styles.formRow}>
                <Input
                  label="Tenant Slug"
                  value={onboardSlug}
                  onChange={(e) => setOnboardSlug(e.target.value)}
                  placeholder="globex"
                  required
                />
                <Input
                  label="Organization Name"
                  value={onboardName}
                  onChange={(e) => setOnboardName(e.target.value)}
                  placeholder="Globex Corporation"
                  required
                />
              </div>
              <Input
                label="Initial Tenant Admin Email (Optional)"
                type="email"
                value={onboardAdminEmail}
                onChange={(e) => setOnboardAdminEmail(e.target.value)}
                placeholder="admin@globex.com"
              />
              {onboardAdminEmail.trim() && (
                <div className={styles.formRow}>
                  <Input
                    label="Admin Name"
                    value={onboardAdminName}
                    onChange={(e) => setOnboardAdminName(e.target.value)}
                    placeholder="Globex Admin"
                  />
                  <Input
                    label="Admin Password"
                    type="password"
                    value={onboardAdminPassword}
                    onChange={(e) => setOnboardAdminPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    required
                  />
                </div>
              )}
              <Button type="submit" variant="primary">
                Onboard Tenant
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

