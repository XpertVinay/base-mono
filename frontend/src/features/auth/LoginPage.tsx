import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  KeyRound,
  ExternalLink,
  RefreshCw,
  Server,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { useTenant } from '../../core/tenant/TenantContext';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Select } from '../../components/ui/Select/Select';
import { Alert } from '../../components/ui/Alert/Alert';
import { Badge } from '../../components/ui/Badge/Badge';
import { iamApi, IamApiError } from './services/iamApi';
import {
  GatewayHealthDto,
  IamRole,
  MultiTenancyStatusDto,
  OidcAuthInitiationDto,
  OidcProviderPublicDto,
  ServiceProviderTokenDto,
} from './types/iam.types';
import styles from './LoginPage.module.css';

type AuthTab = 'login' | 'register' | 'token-exchange' | 'sso-redeem';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z.enum(['USER', 'SUPPORT', 'ADMIN']).default('USER'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { login, loginDemoFallback, register: registerAccount, setSessionFromTokens } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [iamTenantInput, setIamTenantInput] = useState<string>('default');
  const [gatewayHealth, setGatewayHealth] = useState<GatewayHealthDto | null>(null);
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);
  const [mtStatus, setMtStatus] = useState<MultiTenancyStatusDto | null>(null);

  const [providers, setProviders] = useState<OidcProviderPublicDto[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [initiation, setInitiation] = useState<OidcAuthInitiationDto | null>(null);
  const [mockCodeInput, setMockCodeInput] = useState('mock_code:alice@acme.com:Alice Mock:ADMIN');

  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Token Exchange state
  const [exchangeProvider, setExchangeProvider] = useState('google');
  const [exchangeIdToken, setExchangeIdToken] = useState('');
  const [exchangeNonce, setExchangeNonce] = useState('');

  // SSO Redeem state
  const [ssoCode, setSsoCode] = useState('');
  const [ssoTargetService, setSsoTargetService] = useState('order-service');
  const [ssoVerifier, setSsoVerifier] = useState('');
  const [redeemedSpToken, setRedeemedSpToken] = useState<ServiceProviderTokenDto | null>(null);

  const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@enterprise.local',
      password: 'Password123!',
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'USER',
    },
  });

  const loadGatewayAndProviders = useCallback(async (targetTenant: string) => {
    setLoadingProviders(true);
    try {
      const [healthRes, mtRes, provRes] = await Promise.allSettled([
        iamApi.getGatewayHealth(),
        iamApi.getMultiTenancyConfig({ tenantId: targetTenant }),
        iamApi.listPublicProviders({ tenantId: targetTenant }),
      ]);

      if (healthRes.status === 'fulfilled') {
        setGatewayHealth(healthRes.value.data);
        setGatewayOnline(true);
      } else {
        setGatewayHealth(null);
        setGatewayOnline(false);
      }

      if (mtRes.status === 'fulfilled') {
        setMtStatus(mtRes.value.data);
      }

      if (provRes.status === 'fulfilled') {
        setProviders(Array.isArray(provRes.value.data) ? provRes.value.data : []);
      } else {
        setProviders([]);
      }
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    void loadGatewayAndProviders(iamTenantInput);
  }, [iamTenantInput, loadGatewayAndProviders]);

  const handleLoginSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthSuccess(null);
      const ok = await login({ email: data.email, password: data.password }, iamTenantInput || 'default');
      if (ok) {
        navigate(fromPath, { replace: true });
      }
    } catch (err) {
      if (err instanceof IamApiError) {
        if (err.status === 0) {
          setAuthError(
            'Unable to reach API Gateway at http://localhost:4000. Start backend-ms or use Offline Demo Sign-In below.'
          );
        } else {
          setAuthError(err.message);
        }
      } else {
        setAuthError(t('auth.invalidCredentials'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOfflineDemoSignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    const values = loginForm.getValues();
    await loginDemoFallback(
      {
        email: values.email || `admin@${tenant.identity.slug}.demo`,
        password: values.password || 'Password123!',
      },
      tenant.identity.id
    );
    setIsSubmitting(false);
    navigate(fromPath, { replace: true });
  };

  const handleRegisterSubmit = async (data: RegisterFormData) => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthSuccess(null);
      const res = await registerAccount({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role as IamRole,
        tenantId: iamTenantInput || 'default',
      });
      setAuthSuccess(`${res.message}. You can now sign in with ${data.email}.`);
      loginForm.setValue('email', data.email);
      loginForm.setValue('password', data.password);
      setActiveTab('login');
    } catch (err) {
      const apiErr = err instanceof IamApiError ? err : null;
      setAuthError(apiErr ? apiErr.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateFederatedLogin = async (provider: OidcProviderPublicDto) => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthSuccess(null);
      const callbackUrl = `${window.location.origin}/auth/callback/${encodeURIComponent(provider.slug)}`;
      const res = await iamApi.initiateOidcAuthorize(provider.slug, {
        tenantId: iamTenantInput || 'default',
        clientRedirectUrl: callbackUrl,
        loginHint: loginForm.getValues('email') || undefined,
      });
      setInitiation(res.data);
    } catch (err) {
      const apiErr = err instanceof IamApiError ? err : null;
      setAuthError(apiErr ? apiErr.message : `Failed to initiate ${provider.displayName} SSO`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteMockCallback = async () => {
    if (!initiation) return;
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const res = await iamApi.handleOidcCallback({
        provider: initiation.provider,
        code: mockCodeInput,
        state: initiation.state,
      });
      setSessionFromTokens(res.data, 'live');
      navigate(fromPath, { replace: true });
    } catch (err) {
      const apiErr = err instanceof IamApiError ? err : null;
      setAuthError(apiErr ? apiErr.message : 'Federated callback exchange failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTokenExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const res = await iamApi.exchangeIdToken({
        provider: exchangeProvider,
        idToken: exchangeIdToken.trim(),
        tenantId: iamTenantInput || 'default',
        nonce: exchangeNonce.trim() || undefined,
      });
      setSessionFromTokens(res.data, 'live');
      navigate(fromPath, { replace: true });
    } catch (err) {
      const apiErr = err instanceof IamApiError ? err : null;
      setAuthError(apiErr ? apiErr.message : 'ID Token exchange failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRedeemSsoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setRedeemedSpToken(null);
      const res = await iamApi.redeemSsoHandoff({
        code: ssoCode.trim(),
        targetService: ssoTargetService.trim(),
        codeVerifier: ssoVerifier.trim() || undefined,
        expectedTenantId: iamTenantInput || undefined,
      });
      setRedeemedSpToken(res.data);
      setAuthSuccess(`Service token issued for audience '${res.data.audience}'.`);
    } catch (err) {
      const apiErr = err instanceof IamApiError ? err : null;
      setAuthError(apiErr ? apiErr.message : 'Failed to redeem SSO handoff code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const populateDemoUser = (role: 'admin' | 'user') => {
    if (role === 'admin') {
      loginForm.setValue('email', 'admin@enterprise.local');
      loginForm.setValue('password', 'Password123!');
    } else {
      loginForm.setValue('email', `operator@${tenant.identity.slug}.demo`);
      loginForm.setValue('password', 'Password123!');
    }
  };

  return (
    <div className={styles.loginCard}>
      <div className={styles.loginCardHeader}>
        <span className={styles.ssoEnforcedBadge}>Single Sign-On Enforced</span>
        <h2 className={styles.loginTitle}>{tenant.identity.displayName}</h2>
        <p className={styles.loginSubtitle}>Sign in to your team workspace</p>
      </div>

      {/* Gateway & Multi-Tenancy Status Banner */}
      <div className={styles.gatewayBanner}>
        <div className={styles.gatewayStatus}>
          <Server size={14} style={{ color: gatewayOnline ? 'var(--color-success)' : 'var(--color-warning)' }} />
          <span>
            {gatewayOnline === null
              ? 'Probing API Gateway :4000...'
              : gatewayOnline
                ? `Gateway Connected (${gatewayHealth?.transport || 'grpc+http2'})`
                : 'Gateway :4000 Offline'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {mtStatus && <Badge variant="primary">MT: {mtStatus.mode}</Badge>}
          <button
            type="button"
            onClick={() => loadGatewayAndProviders(iamTenantInput)}
            title="Refresh gateway & IdP providers"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* IAM Target Tenant Context Selector */}
      <div className={styles.tenantBar}>
        <div className={styles.tenantBarHeader}>
          <span>IAM Target Tenant (X-Tenant-ID)</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {providers.length} IdP{providers.length === 1 ? '' : 's'} enabled
          </span>
        </div>
        <div className={styles.tenantControls}>
          <Select
            aria-label="Preset IAM Tenant"
            value={
              ['default', tenant.identity.slug, 'acme', 'globex'].includes(iamTenantInput)
                ? iamTenantInput
                : 'custom'
            }
            onChange={(e) => {
              if (e.target.value !== 'custom') setIamTenantInput(e.target.value);
            }}
            options={[
              { value: 'default', label: 'default (Platform)' },
              { value: tenant.identity.slug, label: `${tenant.identity.slug}` },
              { value: 'acme', label: 'acme' },
              { value: 'globex', label: 'globex' },
              { value: 'custom', label: 'Custom Tenant ID...' },
            ]}
          />
          <Input
            aria-label="Custom IAM Tenant ID"
            placeholder="tenantId or slug"
            value={iamTenantInput}
            onChange={(e) => setIamTenantInput(e.target.value.trim())}
          />
        </div>
      </div>

      {/* Auth Mode Navigation Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Authentication methods">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'login'}
          className={`${styles.tab} ${activeTab === 'login' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('login');
            setAuthError(null);
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'register'}
          className={`${styles.tab} ${activeTab === 'register' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('register');
            setAuthError(null);
          }}
        >
          Register
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'token-exchange'}
          className={`${styles.tab} ${activeTab === 'token-exchange' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('token-exchange');
            setAuthError(null);
          }}
        >
          ID Token
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sso-redeem'}
          className={`${styles.tab} ${activeTab === 'sso-redeem' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('sso-redeem');
            setAuthError(null);
          }}
        >
          SSO Redeem
        </button>
      </div>

      {authError && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Alert variant="error">{authError}</Alert>
        </div>
      )}
      {authSuccess && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <Alert variant="success">{authSuccess}</Alert>
        </div>
      )}

      {/* TAB 1: LOCAL LOGIN + FEDERATED OIDC/OAUTH2/SAML SSO */}
      {activeTab === 'login' && (
        <>
          <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className={styles.form}>
            <Input
              label={t('common.email')}
              type="email"
              placeholder="user@enterprise.local"
              error={loginForm.formState.errors.email?.message}
              required
              {...loginForm.register('email')}
            />

            <Input
              label={t('common.password')}
              type="password"
              placeholder="••••••••"
              error={loginForm.formState.errors.password?.message}
              required
              {...loginForm.register('password')}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmitting}
              rightIcon={<ArrowRight size={16} />}
            >
              {t('common.login')}
            </Button>
          </form>

          {/* Dynamic Federated SSO Providers */}
          <div className={styles.divider}>Federated SSO &amp; Enterprise IdP</div>

          {loadingProviders ? (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)', textAlign: 'center' }}>
              Loading tenant OIDC / OAuth2 / SAML providers...
            </div>
          ) : providers.length > 0 ? (
            <div className={styles.providersGrid}>
              {providers.map((prov) => (
                <button
                  key={prov.id}
                  type="button"
                  className={styles.providerButton}
                  disabled={isSubmitting}
                  onClick={() => handleInitiateFederatedLogin(prov)}
                >
                  <div className={styles.providerInfo}>
                    <ShieldCheck size={16} style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{prov.displayName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                        {prov.slug} • {prov.providerType}
                      </div>
                    </div>
                  </div>
                  <div className={styles.providerBadges}>
                    <Badge variant="primary">{prov.protocol}</Badge>
                    {prov.usePkce && <Badge variant="success">PKCE</Badge>}
                    {prov.isSystemDefault && <Badge variant="neutral">System</Badge>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-muted)',
                textAlign: 'center',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border-subtle)',
              }}
            >
              No federated OIDC/SAML providers active for tenant <code>{iamTenantInput || 'default'}</code>.
              Admins can configure providers in the IAM Console after signing in.
            </div>
          )}

          {/* OIDC / SAML Initiation Details & Local Simulator */}
          {initiation && (
            <div className={styles.initiationBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: 'var(--color-primary)' }}>
                  PKCE Authorization Ready ({initiation.provider})
                </strong>
                <Badge variant="success">State Active</Badge>
              </div>
              <div className={styles.codePreview}>{initiation.authorizationUrl}</div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  rightIcon={<ExternalLink size={12} />}
                  onClick={() => {
                    window.location.href = initiation.authorizationUrl;
                  }}
                >
                  Redirect to IdP
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setInitiation(null)}>
                  Dismiss
                </Button>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                <label className={styles.fieldLabel}>
                  Dev Callback / Mock Code Simulator (GET /api/v1/iam/oidc/{initiation.provider}/callback)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Input
                    value={mockCodeInput}
                    onChange={(e) => setMockCodeInput(e.target.value)}
                    placeholder="mock_code:email:name:role or auth code"
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={handleCompleteMockCallback}>
                    Exchange
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Demo & Offline Helper */}
          <div className={styles.helperBox}>
            <div className={styles.helperTitle}>{t('auth.demoHelper')}</div>
            <div className={styles.demoButtons}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => populateDemoUser('admin')}
                leftIcon={<Lock size={12} />}
              >
                {t('auth.adminUser')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => populateDemoUser('user')}
                leftIcon={<Mail size={12} />}
              >
                {t('auth.standardUser')}
              </Button>
              {gatewayOnline === false && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOfflineDemoSignIn}
                  leftIcon={<Sparkles size={12} />}
                >
                  Offline Demo Mode
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: REGISTER NEW USER */}
      {activeTab === 'register' && (
        <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className={styles.form}>
          <Input
            label="Full Name"
            placeholder="Alice Smith"
            error={registerForm.formState.errors.name?.message}
            required
            {...registerForm.register('name')}
          />
          <Input
            label={t('common.email')}
            type="email"
            placeholder="alice@enterprise.local"
            error={registerForm.formState.errors.email?.message}
            required
            {...registerForm.register('email')}
          />
          <Input
            label={t('common.password')}
            type="password"
            placeholder="Min 8 characters"
            helperText="Password is bcrypt-hashed by iam-service and publishes iam.user_registered"
            error={registerForm.formState.errors.password?.message}
            required
            {...registerForm.register('password')}
          />
          <Select
            label="Requested Role (RBAC)"
            options={[
              { value: 'USER', label: 'USER — Standard Portal Access' },
              { value: 'SUPPORT', label: 'SUPPORT — Directory Lookup & Diagnostics' },
              { value: 'ADMIN', label: 'ADMIN — Tenant & Provider Administration' },
            ]}
            {...registerForm.register('role')}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            leftIcon={<UserPlus size={16} />}
          >
            Create IAM Account
          </Button>
        </form>
      )}

      {/* TAB 3: EXTERNAL OIDC ID TOKEN EXCHANGE */}
      {activeTab === 'token-exchange' && (
        <form onSubmit={handleTokenExchange} className={styles.form}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Exchange an IdP-issued OIDC <code>id_token</code> via{' '}
            <code>POST /api/v1/iam/oidc/token-exchange</code> for platform tenant-scoped JWTs.
          </div>
          <Input
            label="Provider Slug"
            value={exchangeProvider}
            onChange={(e) => setExchangeProvider(e.target.value)}
            placeholder="google, microsoft, okta, mock"
            required
          />
          <div>
            <label className={styles.fieldLabel}>External OIDC ID Token (JWT) *</label>
            <textarea
              className={styles.textarea}
              value={exchangeIdToken}
              onChange={(e) => setExchangeIdToken(e.target.value)}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
              required
            />
          </div>
          <Input
            label="Expected Nonce (Optional)"
            value={exchangeNonce}
            onChange={(e) => setExchangeNonce(e.target.value)}
            placeholder="Optional OIDC nonce claim"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            leftIcon={<KeyRound size={16} />}
          >
            Exchange ID Token &amp; Sign In
          </Button>
        </form>
      )}

      {/* TAB 4: REDEEM ONE-TIME SSO HANDOFF CODE */}
      {activeTab === 'sso-redeem' && (
        <form onSubmit={handleRedeemSsoCode} className={styles.form}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            Redeem a single-use PKCE SSO handoff code via <code>POST /api/v1/iam/sso/redeem</code> for an
            audience-scoped service provider token.
          </div>
          <Input
            label="SSO Handoff Code"
            value={ssoCode}
            onChange={(e) => setSsoCode(e.target.value)}
            placeholder="sso_..."
            required
          />
          <Input
            label="Target Microservice Audience"
            value={ssoTargetService}
            onChange={(e) => setSsoTargetService(e.target.value)}
            placeholder="order-service"
            required
          />
          <Input
            label="PKCE Code Verifier (if codeChallenge was used)"
            value={ssoVerifier}
            onChange={(e) => setSsoVerifier(e.target.value)}
            placeholder="Base64URL PKCE verifier"
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            leftIcon={<CheckCircle2 size={16} />}
          >
            Redeem SSO Handoff Code
          </Button>

          {redeemedSpToken && (
            <div className={styles.resultCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Issued Service Provider Token</strong>
                <Badge variant="success">aud: {redeemedSpToken.audience}</Badge>
              </div>
              <div>
                Tenant: <code>{redeemedSpToken.tenantId}</code> • TTL: {redeemedSpToken.expiresIn}s
              </div>
              <div className={styles.codePreview}>{redeemedSpToken.accessToken}</div>
            </div>
          )}

          {!redeemedSpToken && authError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-muted)' }}>
              <AlertTriangle size={13} /> Handoff codes expire in 60s and are single-use.
            </div>
          )}
        </form>
      )}
    </div>
  );
};
