import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, LogOut, ShieldOff, ExternalLink, Activity } from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import { SloResultDto, SsoSessionDto } from '../../auth/types/iam.types';
import styles from '../IamControlPlanePage.module.css';

export const SsoSessionsTab: React.FC = () => {
  const navigate = useNavigate();
  const { token, user, sessionId: currentSessionId, connectionMode, logout } = useAuthStore();

  const [sessions, setSessions] = useState<SsoSessionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sloResult, setSloResult] = useState<SloResultDto | null>(null);

  // Back-channel logout simulator
  const [bcProvider, setBcProvider] = useState('google');
  const [bcToken, setBcToken] = useState('');
  const [bcResult, setBcResult] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!token || connectionMode === 'demo') return;
    setLoading(true);
    setError(null);
    try {
      const res = await iamApi.listSsoSessions({ token, tenantId: user?.tenantId });
      setSessions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to load SSO sessions');
    } finally {
      setLoading(false);
    }
  }, [token, user?.tenantId, connectionMode]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = async (targetSessionId: string) => {
    if (!token) return;
    setError(null);
    try {
      const result = await logout({ sessionId: targetSessionId });
      setSloResult(result);
      if (targetSessionId === currentSessionId) {
        navigate('/login');
      } else {
        await loadSessions();
      }
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Failed to revoke session');
    }
  };

  const handleGlobalSlo = async () => {
    setError(null);
    const result = await logout({
      allSessions: true,
      postLogoutRedirectUri: `${window.location.origin}/login`,
    });
    setSloResult(result);
    if (!result?.idpLogoutUrl) {
      navigate('/login');
    }
  };

  const handleBackchannelLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBcResult(null);
    try {
      const res = await iamApi.triggerBackchannelLogout(bcProvider.trim(), bcToken.trim(), {
        tenantId: user?.tenantId,
      });
      setBcResult(`Back-channel logout processed: ${res.data.revokedSessions} session(s) revoked.`);
      await loadSessions();
    } catch (err) {
      setError(err instanceof IamApiError ? err.message : 'Back-channel logout failed');
    }
  };

  return (
    <div className={styles.grid}>
      <Card className={styles.fullSpan}>
        <CardHeader
          title="Active SSO Sessions & Single Logout (SLO)"
          subtitle="GET /api/v1/iam/sso/sessions & POST /api/v1/iam/sso/logout"
          action={
            <div className={styles.actionRow}>
              <Button
                size="sm"
                variant="secondary"
                isLoading={loading}
                onClick={loadSessions}
                leftIcon={<RefreshCw size={14} />}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleGlobalSlo}
                leftIcon={<LogOut size={14} />}
              >
                Global SLO (All Sessions)
              </Button>
            </div>
          }
        />
        <CardBody>
          <div className={styles.formStack}>
            {error && <Alert variant="error">{error}</Alert>}

            {sloResult && (
              <Alert variant="success">
                SLO completed: {sloResult.revokedSessions} session(s) revoked.
                {sloResult.idpLogoutUrl && (
                  <div style={{ marginTop: '6px' }}>
                    <a
                      href={sloResult.idpLogoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Continue to Upstream IdP Logout <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </Alert>
            )}

            {connectionMode === 'demo' ? (
              <div className={styles.emptyState}>
                Running in Offline Demo Mode. Connect to API Gateway :4000 to inspect live PostgreSQL/Redis SSO
                sessions.
              </div>
            ) : sessions.length === 0 ? (
              <div className={styles.emptyState}>No active SSO sessions found for this user.</div>
            ) : (
              <div className={styles.kvList}>
                {sessions.map((s) => {
                  const isCurrent = s.id === currentSessionId;
                  return (
                    <div key={s.id} className={styles.kvRow} style={{ flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div className={styles.actionRow}>
                          <code>{s.id}</code>
                          {isCurrent && <Badge variant="success">Current Session</Badge>}
                          <Badge variant="primary">{s.authMethod}</Badge>
                          {s.providerSlug && <Badge variant="neutral">{s.providerSlug}</Badge>}
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
                          Created: {new Date(s.createdAt).toLocaleString()} • Last Activity:{' '}
                          {new Date(s.lastActivityAt).toLocaleString()} • Expires:{' '}
                          {new Date(s.expiresAt).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant={isCurrent ? 'danger' : 'outline'}
                        onClick={() => handleRevokeSession(s.id)}
                        leftIcon={<ShieldOff size={13} />}
                      >
                        {isCurrent ? 'SLO & Sign Out' : 'Revoke'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* OIDC Back-Channel Logout Endpoint Tester */}
      <Card className={styles.fullSpan}>
        <CardHeader
          title="OIDC Back-Channel Logout Simulator"
          subtitle="POST /api/v1/iam/oidc/:provider/backchannel-logout"
          action={<Activity size={18} style={{ color: 'var(--color-accent)' }} />}
        />
        <CardBody>
          <form onSubmit={handleBackchannelLogout} className={styles.formStack}>
            {bcResult && <Alert variant="success">{bcResult}</Alert>}
            <div className={styles.formRow}>
              <Input
                label="Provider Slug"
                value={bcProvider}
                onChange={(e) => setBcProvider(e.target.value)}
                placeholder="google"
                required
              />
              <Input
                label="OIDC logout_token (JWT)"
                value={bcToken}
                onChange={(e) => setBcToken(e.target.value)}
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                required
              />
            </div>
            <div>
              <Button type="submit" size="sm" variant="secondary">
                Dispatch Back-Channel Logout
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

