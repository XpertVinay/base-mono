import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  Compass,
  CheckCircle2,
  XCircle,
  GitMerge,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { isAdmin, isPlatformAdmin } from '../../../core/auth/rbac';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Select } from '../../../components/ui/Select/Select';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import {
  FederationProtocol,
  OidcDiscoveryMetadata,
  OidcProviderDto,
  OidcProviderType,
} from '../../auth/types/iam.types';
import styles from '../IamControlPlanePage.module.css';

const PROVIDER_TYPES: OidcProviderType[] = [
  'GENERIC_OIDC',
  'GENERIC_OAUTH2',
  'GOOGLE',
  'ENTRA_ID',
  'OKTA',
  'KEYCLOAK',
  'SAML',
  'MOCK',
];

export const OidcProvidersAdminTab: React.FC = () => {
  const { token, user, connectionMode } = useAuthStore();
  const userIsAdmin = isAdmin(user);
  const userIsPlatformAdmin = isPlatformAdmin(user);

  const [supportedTypes, setSupportedTypes] = useState<OidcProviderType[]>(PROVIDER_TYPES);
  const [providers, setProviders] = useState<OidcProviderDto[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<OidcProviderDto[]>([]);
  const [discoveryResult, setDiscoveryResult] = useState<{ id: string; metadata: OidcDiscoveryMetadata } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Custom Provider form
  const [slug, setSlug] = useState('mock-idp');
  const [providerType, setProviderType] = useState<OidcProviderType>('MOCK');
  const [displayName, setDisplayName] = useState('Enterprise Mock OIDC');
  const [issuerUrl, setIssuerUrl] = useState('https://mock-idp.enterprise.local');
  const [clientId, setClientId] = useState('platform-client-id');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('http://localhost:4000/api/v1/iam/oidc/mock-idp/callback');
  const [scopes, setScopes] = useState('openid profile email');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [roleMappingJson, setRoleMappingJson] = useState('{"Platform-Admins": "ADMIN"}');
  const [usePkce, setUsePkce] = useState(true);
  const [autoProvision, setAutoProvision] = useState(true);
  const [isSystemDefault, setIsSystemDefault] = useState(false);

  // SAML extra fields
  const [idpSsoUrl, setIdpSsoUrl] = useState('');
  const [idpEntityId, setIdpEntityId] = useState('');
  const [spEntityId, setSpEntityId] = useState('');
  const [idpCertificatePem, setIdpCertificatePem] = useState('');

  // Associate System-Default Provider form
  const [assocSystemProvider, setAssocSystemProvider] = useState('google');
  const [assocSlug, setAssocSlug] = useState('');
  const [assocClientId, setAssocClientId] = useState('');
  const [assocClientSecret, setAssocClientSecret] = useState('');
  const [assocDomains, setAssocDomains] = useState('');

  const loadAdminProviders = useCallback(async () => {
    if (!token || connectionMode === 'demo' || !userIsAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [typesRes, listRes, pendingRes] = await Promise.allSettled([
        iamApi.listSupportedProviderTypes({ token, tenantId: user?.tenantId }),
        iamApi.adminListProviders({ token, tenantId: user?.tenantId, includeSystemDefaults: true }),
        userIsPlatformAdmin
          ? iamApi.adminListPendingApprovals({ token, tenantId: user?.tenantId })
          : Promise.resolve(null),
      ]);

      if (typesRes.status === 'fulfilled' && Array.isArray(typesRes.value.data)) {
        setSupportedTypes(typesRes.value.data);
      }
      if (listRes.status === 'fulfilled') {
        setProviders(Array.isArray(listRes.value.data) ? listRes.value.data : []);
      } else {
        setError(listRes.reason instanceof Error ? listRes.reason.message : 'Failed to list providers');
      }
      if (pendingRes.status === 'fulfilled' && pendingRes.value) {
        setPendingApprovals(Array.isArray(pendingRes.value.data) ? pendingRes.value.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, user?.tenantId, connectionMode, userIsAdmin, userIsPlatformAdmin]);

  useEffect(() => {
    void loadAdminProviders();
  }, [loadAdminProviders]);

  const handleCreateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    try {
      let roleMapping: Record<string, string> | undefined;
      if (roleMappingJson.trim()) {
        roleMapping = JSON.parse(roleMappingJson);
      }

      const protocol: FederationProtocol =
        providerType === 'SAML' ? 'SAML' : providerType === 'GENERIC_OAUTH2' ? 'OAUTH2' : 'OIDC';

      const res = await iamApi.adminConfigureProvider(
        {
          slug: slug.trim(),
          providerType,
          protocol,
          displayName: displayName.trim(),
          issuerUrl: issuerUrl.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim() || undefined,
          redirectUri: redirectUri.trim(),
          scopes: scopes.trim() || undefined,
          usePkce,
          autoProvision,
          allowedDomains: allowedDomains
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
          roleMapping,
          isSystemDefault: userIsPlatformAdmin ? isSystemDefault : undefined,
          ...(providerType === 'SAML'
            ? {
                samlConfig: {
                  idpSsoUrl: idpSsoUrl.trim() || undefined,
                  idpEntityId: idpEntityId.trim() || undefined,
                  spEntityId: spEntityId.trim() || undefined,
                  idpCertificatePem: idpCertificatePem.trim() || undefined,
                },
              }
            : {}),
        },
        { token, tenantId: user?.tenantId }
      );

      setSuccessMsg(`Provider '${res.data.slug}' saved (Approval: ${res.data.approvalStatus}).`);
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : err instanceof Error ? err.message : 'Create failed');
    }
  };

  const handleAssociateSystemProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await iamApi.adminAssociateSystemProvider(
        {
          systemProvider: assocSystemProvider.trim(),
          slug: assocSlug.trim() || undefined,
          clientId: assocClientId.trim() || undefined,
          clientSecret: assocClientSecret.trim() || undefined,
          allowedDomains: assocDomains
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
          inheritsSystemConfig: true,
        },
        { token, tenantId: user?.tenantId }
      );
      setSuccessMsg(`System provider associated (${res.data.approvalStatus}).`);
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Association failed');
    }
  };

  const handleToggleEnabled = async (prov: OidcProviderDto) => {
    if (!token) return;
    setError(null);
    try {
      await iamApi.adminUpdateProvider(
        prov.id,
        { isEnabled: !prov.isEnabled },
        { token, tenantId: user?.tenantId }
      );
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to toggle provider');
    }
  };

  const handleTestDiscovery = async (prov: OidcProviderDto) => {
    if (!token) return;
    setError(null);
    setDiscoveryResult(null);
    try {
      const res = await iamApi.adminTestDiscovery(prov.id, { token, tenantId: user?.tenantId });
      setDiscoveryResult({ id: prov.slug, metadata: res.data });
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Discovery check failed');
    }
  };

  const handleDeleteProvider = async (prov: OidcProviderDto) => {
    if (!token) return;
    setError(null);
    try {
      await iamApi.adminDeleteProvider(prov.id, { token, tenantId: user?.tenantId });
      setSuccessMsg(`Provider '${prov.slug}' deleted.`);
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Delete failed');
    }
  };

  const handleApprove = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await iamApi.adminApproveProvider(id, { token, tenantId: user?.tenantId });
      setSuccessMsg('Tenant federation override approved.');
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    setError(null);
    try {
      await iamApi.adminRejectProvider(id, 'Rejected by platform administrator', {
        token,
        tenantId: user?.tenantId,
      });
      setSuccessMsg('Tenant federation override rejected.');
      await loadAdminProviders();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Rejection failed');
    }
  };

  if (!userIsAdmin) {
    return (
      <Alert variant="warning">
        Admin RBAC Role Required: Configuring OIDC/OAuth2/SAML identity providers requires the{' '}
        <strong>ADMIN</strong> role. Your current role is <strong>{user?.role}</strong>.
      </Alert>
    );
  }

  return (
    <div className={styles.grid}>
      {/* Supported Types & Configured Providers List */}
      <Card className={styles.fullSpan}>
        <CardHeader
          title="Configured OIDC / OAuth2 / SAML Providers"
          subtitle="GET /api/v1/iam/oidc/admin/providers?includeSystemDefaults=true"
          action={
            <Button
              size="sm"
              variant="secondary"
              isLoading={loading}
              onClick={loadAdminProviders}
              leftIcon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          }
        />
        <CardBody>
          <div className={styles.formStack}>
            {error && <Alert variant="error">{error}</Alert>}
            {successMsg && <Alert variant="success">{successMsg}</Alert>}

            <div className={styles.actionRow}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
                Supported Adapters:
              </span>
              {supportedTypes.map((st) => (
                <Badge key={st} variant="neutral">
                  {st}
                </Badge>
              ))}
            </div>

            {providers.length === 0 ? (
              <div className={styles.emptyState}>No providers configured for this tenant yet.</div>
            ) : (
              <div className={styles.kvList}>
                {providers.map((p) => (
                  <div key={p.id} className={styles.kvRow} style={{ flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className={styles.actionRow}>
                        <strong>{p.displayName}</strong>
                        <code>{p.slug}</code>
                        <Badge variant="primary">{p.protocol}</Badge>
                        <Badge variant="neutral">{p.configSource}</Badge>
                        <Badge
                          variant={
                            p.approvalStatus === 'APPROVED'
                              ? 'success'
                              : p.approvalStatus === 'PENDING'
                                ? 'warning'
                                : 'error'
                          }
                        >
                          {p.approvalStatus}
                        </Badge>
                        {!p.isEnabled && <Badge variant="error">Disabled</Badge>}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        Issuer: {p.issuerUrl} • Client ID: <code>{p.clientId}</code>
                      </span>
                    </div>
                    <div className={styles.actionRow}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestDiscovery(p)}
                        leftIcon={<Compass size={13} />}
                      >
                        Test Discovery
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleEnabled(p)}>
                        {p.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                      {p.tenantId === user?.tenantId && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteProvider(p)}
                          leftIcon={<Trash2 size={13} />}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {discoveryResult && (
              <div>
                <span className={styles.fieldLabel}>
                  Discovery Metadata ({discoveryResult.id})
                </span>
                <pre className={styles.codeBlock}>{JSON.stringify(discoveryResult.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Platform Admin Pending Approvals */}
      {userIsPlatformAdmin && (
        <Card className={styles.fullSpan}>
          <CardHeader
            title="Platform Admin: Pending Tenant Provider Overrides"
            subtitle="GET /api/v1/iam/oidc/admin/providers/pending — approve or reject tenant credential overrides"
            action={<Shield size={18} style={{ color: 'var(--color-warning)' }} />}
          />
          <CardBody>
            {pendingApprovals.length === 0 ? (
              <div className={styles.emptyState}>No pending tenant federation overrides in queue.</div>
            ) : (
              <div className={styles.kvList}>
                {pendingApprovals.map((pa) => (
                  <div key={pa.id} className={styles.kvRow}>
                    <div>
                      <strong>{pa.displayName}</strong> (<code>{pa.slug}</code>) • Tenant:{' '}
                      <code>{pa.tenantId}</code>
                    </div>
                    <div className={styles.actionRow}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleApprove(pa.id)}
                        leftIcon={<CheckCircle2 size={13} />}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleReject(pa.id)}
                        leftIcon={<XCircle size={13} />}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Configure New OIDC / OAuth2 / SAML Provider */}
      <Card>
        <CardHeader
          title="Configure Federation Provider"
          subtitle="POST /api/v1/iam/oidc/admin/providers"
          action={<Plus size={18} style={{ color: 'var(--color-primary)' }} />}
        />
        <CardBody>
          <form onSubmit={handleCreateProvider} className={styles.formStack}>
            <div className={styles.formRow}>
              <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
              <Select
                label="Provider Adapter Type"
                value={providerType}
                onChange={(e) => setProviderType(e.target.value as OidcProviderType)}
                options={PROVIDER_TYPES.map((pt) => ({ value: pt, label: pt }))}
              />
            </div>

            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              label="Issuer URL"
              value={issuerUrl}
              onChange={(e) => setIssuerUrl(e.target.value)}
              required
            />

            <div className={styles.formRow}>
              <Input
                label="Client ID / SP Entity ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              />
              <Input
                label="Client Secret (Encrypted at rest)"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
              />
            </div>

            <Input
              label="Callback Redirect URI"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              required
            />

            <div className={styles.formRow}>
              <Input label="Scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} />
              <Input
                label="Allowed Email Domains (comma-sep)"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="acme.com, globex.com"
              />
            </div>

            <div>
              <label className={styles.fieldLabel}>Role Mapping JSON (External Group/Role → IAM Role)</label>
              <textarea
                className={styles.textarea}
                value={roleMappingJson}
                onChange={(e) => setRoleMappingJson(e.target.value)}
              />
            </div>

            {providerType === 'SAML' && (
              <div className={styles.formStack}>
                <Input
                  label="SAML IdP SSO URL"
                  value={idpSsoUrl}
                  onChange={(e) => setIdpSsoUrl(e.target.value)}
                  placeholder="https://idp.example.com/saml/sso"
                />
                <div className={styles.formRow}>
                  <Input
                    label="IdP Entity ID"
                    value={idpEntityId}
                    onChange={(e) => setIdpEntityId(e.target.value)}
                  />
                  <Input
                    label="SP Entity ID"
                    value={spEntityId}
                    onChange={(e) => setSpEntityId(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.fieldLabel}>IdP X.509 Certificate PEM</label>
                  <textarea
                    className={styles.textarea}
                    value={idpCertificatePem}
                    onChange={(e) => setIdpCertificatePem(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE-----..."
                  />
                </div>
              </div>
            )}

            <div className={styles.actionRow}>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={usePkce} onChange={(e) => setUsePkce(e.target.checked)} />
                Enforce PKCE (S256)
              </label>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={autoProvision}
                  onChange={(e) => setAutoProvision(e.target.checked)}
                />
                JIT Auto-Provision Users
              </label>
              {userIsPlatformAdmin && (
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={isSystemDefault}
                    onChange={(e) => setIsSystemDefault(e.target.checked)}
                  />
                  System Default (Inherited)
                </label>
              )}
            </div>

            <Button type="submit" variant="primary">
              Save Federation Provider
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Associate / Override System-Default Provider */}
      <Card>
        <CardHeader
          title="Associate System-Default Provider"
          subtitle="POST /api/v1/iam/oidc/admin/providers/associate"
          action={<GitMerge size={18} style={{ color: 'var(--color-secondary)' }} />}
        />
        <CardBody>
          <form onSubmit={handleAssociateSystemProvider} className={styles.formStack}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Inherit a platform-wide system provider (e.g. <code>google</code>, <code>microsoft</code>) for your
              tenant, optionally overriding credentials or domain restrictions (triggers approval workflow if
              credentials change).
            </div>
            <Input
              label="System Provider Slug"
              value={assocSystemProvider}
              onChange={(e) => setAssocSystemProvider(e.target.value)}
              placeholder="google"
              required
            />
            <Input
              label="Custom Tenant Slug Override (Optional)"
              value={assocSlug}
              onChange={(e) => setAssocSlug(e.target.value)}
              placeholder="google-corp"
            />
            <Input
              label="Override Client ID (Optional)"
              value={assocClientId}
              onChange={(e) => setAssocClientId(e.target.value)}
            />
            <Input
              label="Override Client Secret (Optional)"
              type="password"
              value={assocClientSecret}
              onChange={(e) => setAssocClientSecret(e.target.value)}
            />
            <Input
              label="Allowed Domains Override (comma-sep)"
              value={assocDomains}
              onChange={(e) => setAssocDomains(e.target.value)}
              placeholder="acme.com"
            />
            <Button type="submit" variant="secondary">
              Associate System Provider
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

