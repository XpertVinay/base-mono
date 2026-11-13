import React, { useState } from 'react';
import { ArrowRightLeft, KeyRound, SearchCheck, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { Select } from '../../../components/ui/Select/Select';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Alert } from '../../../components/ui/Alert/Alert';
import { iamApi, IamApiError } from '../../auth/services/iamApi';
import {
  IntrospectedTokenDto,
  ServiceProviderTokenDto,
  SsoHandoffCodeDto,
} from '../../auth/types/iam.types';
import { decodeJwt, generatePkcePair } from '../../auth/utils/cryptoUtils';
import styles from '../IamControlPlanePage.module.css';

const PLATFORM_MICROSERVICES = [
  { value: 'order-service', label: 'order-service (:50056)' },
  { value: 'inventory-service', label: 'inventory-service (:50059)' },
  { value: 'transaction-service', label: 'transaction-service (:50057)' },
  { value: 'config-service', label: 'config-service (:50053)' },
  { value: 'asset-service', label: 'asset-service (:50052)' },
  { value: 'notification-service', label: 'notification-service (:50054)' },
  { value: 'scheduler-service', label: 'scheduler-service (:50055)' },
  { value: 'search-service', label: 'search-service (:50058)' },
  { value: 'audit-service', label: 'audit-service (:50061)' },
  { value: 'iam-service', label: 'iam-service (:50051)' },
];

export const SsoTokenToolsTab: React.FC = () => {
  const { token, user } = useAuthStore();

  // 1. Direct Service Token Exchange
  const [exTarget, setExTarget] = useState('order-service');
  const [exScope, setExScope] = useState('orders:read orders:write');
  const [exTtl, setExTtl] = useState('300');
  const [exLoading, setExLoading] = useState(false);
  const [exError, setExError] = useState<string | null>(null);
  const [exResult, setExResult] = useState<ServiceProviderTokenDto | null>(null);

  // 2. PKCE SSO Handoff Create & Redeem
  const [handoffTarget, setHandoffTarget] = useState('order-service');
  const [handoffScope, setHandoffScope] = useState('orders:read');
  const [handoffRedirectUri, setHandoffRedirectUri] = useState('http://localhost:3000/auth/callback');
  const [pkceVerifier, setPkceVerifier] = useState('');
  const [pkceChallenge, setPkceChallenge] = useState('');
  const [handoffResult, setHandoffResult] = useState<SsoHandoffCodeDto | null>(null);
  const [redeemedResult, setRedeemedResult] = useState<ServiceProviderTokenDto | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  // 3. Token Introspection
  const [introspectInput, setIntrospectInput] = useState(token || '');
  const [expectedTenant, setExpectedTenant] = useState(user?.tenantId || '');
  const [expectedAudience, setExpectedAudience] = useState('');
  const [introspectResult, setIntrospectResult] = useState<IntrospectedTokenDto | null>(null);
  const [introspectError, setIntrospectError] = useState<string | null>(null);
  const [introspectLoading, setIntrospectLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleExchangeToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setExLoading(true);
    setExError(null);
    setExResult(null);
    try {
      const res = await iamApi.exchangeServiceToken(
        {
          targetService: exTarget,
          scope: exScope.trim() || undefined,
          expiresInSeconds: Number(exTtl) || 300,
        },
        { token, tenantId: user?.tenantId }
      );
      setExResult(res.data);
      setIntrospectInput(res.data.accessToken);
      setExpectedAudience(res.data.audience);
    } catch (err) {
      setExError(err instanceof IamApiError ? err.message : 'Service token exchange failed');
    } finally {
      setExLoading(false);
    }
  };

  const handleGenerateAndCreateHandoff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setHandoffLoading(true);
    setHandoffError(null);
    setRedeemedResult(null);
    try {
      const pair = await generatePkcePair();
      setPkceVerifier(pair.codeVerifier);
      setPkceChallenge(pair.codeChallenge);

      const res = await iamApi.createSsoHandoff(
        {
          targetService: handoffTarget,
          scope: handoffScope.trim() || undefined,
          codeChallenge: pair.codeChallenge,
          redirectUri: handoffRedirectUri.trim() || undefined,
        },
        { token, tenantId: user?.tenantId }
      );
      setHandoffResult(res.data);
    } catch (err) {
      setHandoffError(err instanceof IamApiError ? err.message : 'Failed to create SSO handoff code');
    } finally {
      setHandoffLoading(false);
    }
  };

  const handleRedeemCreatedHandoff = async () => {
    if (!handoffResult) return;
    setHandoffLoading(true);
    setHandoffError(null);
    try {
      const res = await iamApi.redeemSsoHandoff(
        {
          code: handoffResult.code,
          targetService: handoffResult.targetService,
          codeVerifier: pkceVerifier || undefined,
          expectedTenantId: user?.tenantId,
        },
        { tenantId: user?.tenantId }
      );
      setRedeemedResult(res.data);
      setIntrospectInput(res.data.accessToken);
      setExpectedAudience(res.data.audience);
    } catch (err) {
      setHandoffError(err instanceof IamApiError ? err.message : 'Failed to redeem SSO handoff code');
    } finally {
      setHandoffLoading(false);
    }
  };

  const handleIntrospect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntrospectLoading(true);
    setIntrospectError(null);
    try {
      const res = await iamApi.introspectToken({
        token: introspectInput.trim(),
        expectedTenantId: expectedTenant.trim() || undefined,
        expectedAudience: expectedAudience.trim() || undefined,
      });
      setIntrospectResult(res.data);
    } catch (err) {
      setIntrospectError(err instanceof IamApiError ? err.message : 'Introspection failed');
    } finally {
      setIntrospectLoading(false);
    }
  };

  const copyServiceJwt = async (jwtStr: string) => {
    await navigator.clipboard.writeText(jwtStr);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1800);
  };

  return (
    <div className={styles.grid}>
      {/* 1. Direct Audience-Scoped Service Token Exchange */}
      <Card>
        <CardHeader
          title="Service Provider Token Exchange"
          subtitle="POST /api/v1/iam/sso/exchange — mint audience-scoped microservice JWT"
          action={<ArrowRightLeft size={18} style={{ color: 'var(--color-primary)' }} />}
        />
        <CardBody>
          <form onSubmit={handleExchangeToken} className={styles.formStack}>
            {exError && <Alert variant="error">{exError}</Alert>}
            <Select
              label="Target Downstream Microservice (aud)"
              value={exTarget}
              onChange={(e) => setExTarget(e.target.value)}
              options={PLATFORM_MICROSERVICES}
            />
            <div className={styles.formRow}>
              <Input
                label="Scopes"
                value={exScope}
                onChange={(e) => setExScope(e.target.value)}
                placeholder="orders:read orders:write"
              />
              <Input
                label="TTL (seconds, 30–3600)"
                type="number"
                min={30}
                max={3600}
                value={exTtl}
                onChange={(e) => setExTtl(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" isLoading={exLoading}>
              Mint Service Token
            </Button>

            {exResult && (
              <div className={styles.formStack}>
                <div className={styles.actionRow}>
                  <Badge variant="success">aud: {exResult.audience}</Badge>
                  <Badge variant="primary">TTL: {exResult.expiresIn}s</Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => copyServiceJwt(exResult.accessToken)}
                    leftIcon={copiedToken ? <Check size={12} /> : <Copy size={12} />}
                  >
                    {copiedToken ? 'Copied' : 'Copy JWT'}
                  </Button>
                </div>
                <pre className={styles.codeBlock}>
                  {JSON.stringify(decodeJwt(exResult.accessToken)?.payload || exResult, null, 2)}
                </pre>
              </div>
            )}
          </form>
        </CardBody>
      </Card>

      {/* 2. Single-Use PKCE SSO Handoff */}
      <Card>
        <CardHeader
          title="Single-Use PKCE SSO Handoff"
          subtitle="POST /api/v1/iam/sso/handoff -> POST /api/v1/iam/sso/redeem"
          action={<KeyRound size={18} style={{ color: 'var(--color-secondary)' }} />}
        />
        <CardBody>
          <form onSubmit={handleGenerateAndCreateHandoff} className={styles.formStack}>
            {handoffError && <Alert variant="error">{handoffError}</Alert>}
            <Select
              label="Target Service Provider"
              value={handoffTarget}
              onChange={(e) => setHandoffTarget(e.target.value)}
              options={PLATFORM_MICROSERVICES}
            />
            <div className={styles.formRow}>
              <Input
                label="Scope"
                value={handoffScope}
                onChange={(e) => setHandoffScope(e.target.value)}
              />
              <Input
                label="Redirect URI (Optional)"
                value={handoffRedirectUri}
                onChange={(e) => setHandoffRedirectUri(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" isLoading={handoffLoading}>
              Generate PKCE &amp; Create Handoff Code
            </Button>

            {handoffResult && (
              <div className={styles.formStack}>
                <div className={styles.kvList}>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>One-Time Code (60s TTL)</span>
                    <code>{handoffResult.code}</code>
                  </div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>PKCE S256 Challenge</span>
                    <code style={{ fontSize: '0.72rem' }}>{pkceChallenge}</code>
                  </div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>PKCE Verifier</span>
                    <code style={{ fontSize: '0.72rem' }}>{pkceVerifier}</code>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  isLoading={handoffLoading}
                  onClick={handleRedeemCreatedHandoff}
                >
                  Redeem Handoff Code Now (Consume Single-Use Code)
                </Button>
              </div>
            )}

            {redeemedResult && (
              <Alert variant="success">
                Handoff redeemed! Issued token for <strong>{redeemedResult.audience}</strong> (expires in{' '}
                {redeemedResult.expiresIn}s). Try redeeming again to verify replay protection!
              </Alert>
            )}
          </form>
        </CardBody>
      </Card>

      {/* 3. Token Introspection Console */}
      <Card className={styles.fullSpan}>
        <CardHeader
          title="SSO Token Introspection & Revocation Check"
          subtitle="POST /api/v1/iam/sso/introspect — verifies signature, active SSO session, tenant & audience"
          action={<SearchCheck size={18} style={{ color: 'var(--color-accent)' }} />}
        />
        <CardBody>
          <form onSubmit={handleIntrospect} className={styles.formStack}>
            {introspectError && <Alert variant="error">{introspectError}</Alert>}
            <div>
              <label className={styles.fieldLabel}>JWT Token to Introspect *</label>
              <textarea
                className={styles.textarea}
                value={introspectInput}
                onChange={(e) => setIntrospectInput(e.target.value)}
                placeholder="Paste accessToken or service provider token..."
                required
              />
            </div>
            <div className={styles.formRow}>
              <Input
                label="Expected Tenant ID (Optional)"
                value={expectedTenant}
                onChange={(e) => setExpectedTenant(e.target.value)}
                placeholder="default"
              />
              <Input
                label="Expected Audience (Optional)"
                value={expectedAudience}
                onChange={(e) => setExpectedAudience(e.target.value)}
                placeholder="platform-api or order-service"
              />
            </div>
            <div className={styles.actionRow}>
              <Button type="submit" variant="primary" isLoading={introspectLoading}>
                Introspect Token
              </Button>
              {token && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIntrospectInput(token);
                    setExpectedAudience('');
                  }}
                >
                  Use Current Session Token
                </Button>
              )}
            </div>

            {introspectResult && (
              <div className={styles.formStack}>
                <div className={styles.actionRow}>
                  <Badge variant={introspectResult.active ? 'success' : 'error'}>
                    {introspectResult.active ? 'ACTIVE' : `INACTIVE (${introspectResult.reason})`}
                  </Badge>
                  {introspectResult.audience && <Badge variant="primary">aud: {introspectResult.audience}</Badge>}
                  {introspectResult.role && <Badge variant="neutral">role: {introspectResult.role}</Badge>}
                </div>
                <pre className={styles.codeBlock}>{JSON.stringify(introspectResult, null, 2)}</pre>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

