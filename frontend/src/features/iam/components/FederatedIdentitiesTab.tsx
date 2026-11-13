import React, { useCallback, useEffect, useState } from 'react';
import { Link2, Unlink, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import {
  FederatedIdentityDto,
  OidcAuthInitiationDto,
  OidcProviderPublicDto,
} from '../../auth/types/iam.types';
import styles from '../IamControlPlanePage.module.css';

export const FederatedIdentitiesTab: React.FC = () => {
  const { token, user, connectionMode } = useAuthStore();

  const [identities, setIdentities] = useState<FederatedIdentityDto[]>([]);
  const [providers, setProviders] = useState<OidcProviderPublicDto[]>([]);
  const [linkInit, setLinkInit] = useState<OidcAuthInitiationDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token || connectionMode === 'demo') return;
    setLoading(true);
    setError(null);
    try {
      const [idRes, provRes] = await Promise.all([
        iamApi.listFederatedIdentities({ token, tenantId: user?.tenantId }),
        iamApi.listPublicProviders({ tenantId: user?.tenantId }),
      ]);
      setIdentities(Array.isArray(idRes.data) ? idRes.data : []);
      setProviders(Array.isArray(provRes.data) ? provRes.data : []);
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to load federated identities');
    } finally {
      setLoading(false);
    }
  }, [token, user?.tenantId, connectionMode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleLinkProvider = async (providerSlug: string) => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await iamApi.initiateAccountLink(
        providerSlug,
        { clientRedirectUrl: `${window.location.origin}/auth/callback/${encodeURIComponent(providerSlug)}` },
        { token, tenantId: user?.tenantId }
      );
      setLinkInit(res.data);
      setSuccessMsg(`Account-linking URL generated for '${providerSlug}'.`);
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to initiate provider linking');
    }
  };

  const handleUnlink = async (identityId: string) => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await iamApi.unlinkFederatedIdentity(identityId, { token, tenantId: user?.tenantId });
      setSuccessMsg('Federated identity unlinked successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to unlink federated identity');
    }
  };

  return (
    <div className={styles.grid}>
      <Card>
        <CardHeader
          title="Linked Federated Identities"
          subtitle="GET /api/v1/iam/federated-identities & DELETE /:id"
          action={
            <Button size="sm" variant="secondary" isLoading={loading} onClick={loadData} leftIcon={<RefreshCw size={14} />}>
              Refresh
            </Button>
          }
        />
        <CardBody>
          <div className={styles.formStack}>
            {error && <Alert variant="error">{error}</Alert>}
            {successMsg && <Alert variant="success">{successMsg}</Alert>}

            {connectionMode === 'demo' ? (
              <div className={styles.emptyState}>
                Connect to live API Gateway (:4000) to manage linked OIDC/OAuth2/SAML identities.
              </div>
            ) : identities.length === 0 ? (
              <div className={styles.emptyState}>No external federated identities linked to this account yet.</div>
            ) : (
              <div className={styles.kvList}>
                {identities.map((ident) => (
                  <div key={ident.id} className={styles.kvRow}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className={styles.actionRow}>
                        <Badge variant="primary">{ident.providerSlug}</Badge>
                        <strong>{ident.email || ident.subject}</strong>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        Subject: <code>{ident.subject}</code>
                        {ident.lastLoginAt ? ` • Last Login: ${new Date(ident.lastLoginAt).toLocaleString()}` : ''}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnlink(ident.id)}
                      leftIcon={<Unlink size={13} />}
                    >
                      Unlink
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Link Another Identity Provider"
          subtitle="POST /api/v1/iam/oidc/:provider/link"
          action={<Link2 size={18} style={{ color: 'var(--color-primary)' }} />}
        />
        <CardBody>
          <div className={styles.formStack}>
            {providers.length === 0 ? (
              <div className={styles.emptyState}>No enabled federation providers found for your tenant.</div>
            ) : (
              <div className={styles.kvList}>
                {providers.map((p) => (
                  <div key={p.id} className={styles.kvRow}>
                    <div className={styles.actionRow}>
                      <ShieldCheck size={16} style={{ color: 'var(--color-primary)' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.displayName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                          {p.slug} • {p.protocol}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" variant="primary" onClick={() => handleLinkProvider(p.slug)}>
                      Link Account
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {linkInit && (
              <div className={styles.formStack}>
                <pre className={styles.codeBlock}>{linkInit.authorizationUrl}</pre>
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    rightIcon={<ExternalLink size={12} />}
                    onClick={() => {
                      window.location.href = linkInit.authorizationUrl;
                    }}
                  >
                    Open Linking Authorization URL
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

