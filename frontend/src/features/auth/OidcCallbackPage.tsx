import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { Button } from '../../components/ui/Button/Button';
import { Alert } from '../../components/ui/Alert/Alert';
import { Badge } from '../../components/ui/Badge/Badge';
import { iamApi, IamApiError } from './services/iamApi';

export const OidcCallbackPage: React.FC = () => {
  const { provider } = useParams<{ provider?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSessionFromTokens } = useAuthStore();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Validating OIDC/SAML callback state & PKCE verifier...');
  const [details, setDetails] = useState<{
    email?: string;
    tenantId?: string;
    provider?: string;
    sessionId?: string;
    ssoCode?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function processCallback() {
      const ssoCode = searchParams.get('sso_code');
      if (ssoCode) {
        if (!active) return;
        setStatus('success');
        setMessage('Received SSO handoff code from federated redirect.');
        setDetails({ ssoCode, provider });
        return;
      }

      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const code = searchParams.get('code');
      const state = searchParams.get('state') || searchParams.get('RelayState') || '';
      const samlResponse = searchParams.get('SAMLResponse');

      if (error) {
        if (!active) return;
        setStatus('error');
        setMessage(errorDescription || error);
        return;
      }

      if (!state || (!code && !samlResponse)) {
        if (!active) return;
        setStatus('error');
        setMessage('Missing required callback parameters (code/SAMLResponse and state).');
        return;
      }

      try {
        const res = await iamApi.handleOidcCallback({
          provider,
          code: code || undefined,
          state,
          SAMLResponse: samlResponse || undefined,
        });
        if (!active) return;

        const user = setSessionFromTokens(res.data, 'live');
        setDetails({
          email: user.email,
          tenantId: user.tenantId,
          provider: res.data.provider || provider,
          sessionId: res.data.sessionId,
        });
        setStatus('success');
        setMessage('Federated identity verified and platform JWT session issued.');
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err instanceof IamApiError ? err.message : 'Federated callback verification failed');
      }
    }

    void processCallback();
    return () => {
      active = false;
    };
  }, [provider, searchParams, setSessionFromTokens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {status === 'processing' && (
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
        )}
        {status === 'success' && <CheckCircle2 size={40} style={{ color: 'var(--color-success)' }} />}
        {status === 'error' && <XCircle size={40} style={{ color: 'var(--color-error)' }} />}
      </div>

      <h2 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text)' }}>
        {status === 'processing'
          ? 'Completing Federated Sign-In'
          : status === 'success'
            ? 'Federation Verified'
            : 'Authentication Callback Error'}
      </h2>

      <Alert variant={status === 'error' ? 'error' : status === 'success' ? 'success' : 'info'}>
        {message}
      </Alert>

      {details && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: 'var(--font-size-xs)',
            textAlign: 'left',
          }}
        >
          {details.email && (
            <div>
              Identity: <strong>{details.email}</strong>
            </div>
          )}
          {details.tenantId && (
            <div>
              Tenant: <code>{details.tenantId}</code>
            </div>
          )}
          {details.provider && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Provider: <Badge variant="primary">{details.provider}</Badge>
            </div>
          )}
          {details.sessionId && (
            <div>
              SSO Session ID: <code>{details.sessionId}</code>
            </div>
          )}
          {details.ssoCode && (
            <div>
              SSO Handoff Code: <code>{details.ssoCode}</code>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center' }}>
        {status === 'success' && !details?.ssoCode && (
          <>
            <Button variant="primary" rightIcon={<ShieldCheck size={16} />} onClick={() => navigate('/iam')}>
              Open IAM &amp; SSO Console
            </Button>
            <Button variant="secondary" rightIcon={<ArrowRight size={16} />} onClick={() => navigate('/')}>
              Dashboard
            </Button>
          </>
        )}
        {(status === 'error' || details?.ssoCode) && (
          <Button variant="primary" onClick={() => navigate('/login')}>
            Return to Sign In
          </Button>
        )}
      </div>
    </div>
  );
};

