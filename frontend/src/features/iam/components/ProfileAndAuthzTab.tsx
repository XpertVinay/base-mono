import React, { useMemo, useState } from 'react';
import {
  User as UserIcon,
  Key,
  RefreshCw,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { getEffectivePermissions, isSupportOrAdmin, normalizeRole } from '../../../core/auth/rbac';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import { IamUserDto } from '../../auth/types/iam.types';
import { decodeJwt } from '../../auth/utils/cryptoUtils';
import styles from '../IamControlPlanePage.module.css';

export const ProfileAndAuthzTab: React.FC = () => {
  const { user, token, refreshToken, expiresAt, connectionMode, fetchProfile, refreshSession } = useAuthStore();

  const [profileLoading, setProfileLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // User Lookup (ADMIN / SUPPORT)
  const [lookupId, setLookupId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<IamUserDto | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const decodedToken = useMemo(() => (token ? decodeJwt(token) : null), [token]);
  const permissions = useMemo(() => getEffectivePermissions(user), [user]);
  const canLookup = isSupportOrAdmin(user);

  const handleSyncProfile = async () => {
    setProfileLoading(true);
    setStatusMsg(null);
    const updated = await fetchProfile();
    setProfileLoading(false);
    if (updated) {
      setStatusMsg({ type: 'success', text: 'Profile synchronized from GET /api/v1/iam/profile.' });
    } else {
      setStatusMsg({ type: 'error', text: 'Could not sync profile (demo mode or token expired).' });
    }
  };

  const handleRefreshJwt = async () => {
    setRefreshLoading(true);
    setStatusMsg(null);
    const ok = await refreshSession();
    setRefreshLoading(false);
    setStatusMsg(
      ok
        ? { type: 'success', text: 'Access & refresh tokens rotated via POST /api/v1/iam/refresh.' }
        : { type: 'error', text: 'Token refresh failed or unavailable in offline demo mode.' }
    );
  };

  const handleCopyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleLookupUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !lookupId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await iamApi.getUserById(lookupId.trim(), { token, tenantId: user?.tenantId });
      setLookupResult(res.data);
    } catch (err) {
      setLookupError(err instanceof IamApiError ? `${err.code || err.status}: ${err.message}` : 'Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className={styles.grid}>
      {/* Identity Profile Card */}
      <Card>
        <CardHeader
          title="Authenticated IAM Profile"
          subtitle="GET /api/v1/iam/profile & POST /api/v1/iam/refresh"
          action={<UserIcon size={18} style={{ color: 'var(--color-primary)' }} />}
        />
        <CardBody>
          <div className={styles.formStack}>
            {statusMsg && <Alert variant={statusMsg.type}>{statusMsg.text}</Alert>}

            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>User ID</span>
                <code>{user?.id || '—'}</code>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Email</span>
                <strong>{user?.email || '—'}</strong>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Display Name</span>
                <span>{user?.name || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Assigned RBAC Role</span>
                <Badge variant={normalizeRole(user?.role) === 'ADMIN' ? 'primary' : 'success'}>
                  {normalizeRole(user?.role)}
                </Badge>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Tenant Context</span>
                <code>{user?.tenantId || 'default'}</code>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Auth Method / Provider</span>
                <div className={styles.actionRow}>
                  <Badge variant="neutral">{user?.authMethod || 'LOCAL'}</Badge>
                  {user?.provider && <Badge variant="primary">{user.provider}</Badge>}
                </div>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Token Expires At</span>
                <span style={{ fontSize: 'var(--font-size-xs)' }}>
                  {expiresAt ? new Date(expiresAt).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            <div className={styles.actionRow}>
              <Button
                size="sm"
                variant="secondary"
                isLoading={profileLoading}
                onClick={handleSyncProfile}
                disabled={connectionMode === 'demo'}
                leftIcon={<RefreshCw size={14} />}
              >
                Sync Profile
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={refreshLoading}
                onClick={handleRefreshJwt}
                disabled={!refreshToken || connectionMode === 'demo'}
                leftIcon={<Key size={14} />}
              >
                Rotate Refresh Token
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Decoded JWT Inspector Card */}
      <Card>
        <CardHeader
          title="JWT Access Token Claims"
          subtitle="Decoded Bearer token claims forwarded by API Gateway"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyToken}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? 'Copied' : 'Copy JWT'}
            </Button>
          }
        />
        <CardBody>
          {decodedToken ? (
            <div className={styles.formStack}>
              <div>
                <span className={styles.fieldLabel}>Header</span>
                <pre className={styles.codeBlock}>{JSON.stringify(decodedToken.header, null, 2)}</pre>
              </div>
              <div>
                <span className={styles.fieldLabel}>Payload Claims (sub, role, tenantId, sid, aud)</span>
                <pre className={styles.codeBlock}>{JSON.stringify(decodedToken.payload, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>No decodable JWT access token in active session.</div>
          )}
        </CardBody>
      </Card>

      {/* RBAC Authorization Matrix */}
      <Card className={styles.fullSpan}>
        <CardHeader
          title="RBAC Authorization Matrix"
          subtitle="Role-based enforcement across IAM, Federation, SSO & Tenant APIs"
          action={<ShieldCheck size={18} style={{ color: 'var(--color-success)' }} />}
        />
        <CardBody>
          <div className={styles.kvList}>
            {permissions.map((perm) => (
              <div key={perm.capability} className={styles.kvRow} style={{ alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontWeight: 600 }}>{perm.capability}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {perm.description}
                  </div>
                  <code style={{ fontSize: '0.72rem', color: 'var(--color-primary)' }}>{perm.endpoint}</code>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <Badge variant={perm.granted ? 'success' : 'neutral'}>
                    {perm.granted ? 'GRANTED' : 'RESTRICTED'}
                  </Badge>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                    Requires: {perm.roles.join(' | ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Admin / Support User Lookup */}
      <Card className={styles.fullSpan}>
        <CardHeader
          title="Tenant User Lookup (RBAC: ADMIN / SUPPORT)"
          subtitle="GET /api/v1/iam/users/:id — enforces tenant isolation and role check"
          action={
            <Badge variant={canLookup ? 'success' : 'warning'}>
              <Lock size={12} /> {canLookup ? 'Authorized' : 'USER role gets 403'}
            </Badge>
          }
        />
        <CardBody>
          <form onSubmit={handleLookupUser} className={styles.formStack}>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <Input
                  label="Target User UUID"
                  placeholder={user?.id || '3fa85f64-5717-4562-b3fc-2c963f66afa6'}
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                isLoading={lookupLoading}
                leftIcon={<Search size={14} />}
              >
                Lookup User
              </Button>
              {user?.id && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLookupId(user.id)}
                >
                  Use My ID
                </Button>
              )}
            </div>

            {lookupError && <Alert variant="error">{lookupError}</Alert>}
            {lookupResult && (
              <pre className={styles.codeBlock}>{JSON.stringify(lookupResult, null, 2)}</pre>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

