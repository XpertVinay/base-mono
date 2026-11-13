import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../core/i18n';
import { TenantContext } from '../core/tenant/TenantContext';
import { DEFAULT_TENANT, DEMO_TENANTS } from '../core/tenant/registry';
import { LoginPage } from '../features/auth/LoginPage';
import { OidcCallbackPage } from '../features/auth/OidcCallbackPage';
import { iamApi } from '../features/auth/services/iamApi';
import { useAuthStore } from '../core/auth/authStore';

function makeMockToken(email = 'admin@enterprise.local', role = 'ADMIN') {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: 'usr_123',
    email,
    name: 'Test Admin',
    role,
    tenantId: 'default',
    sid: 'sso_sess_1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`;
}

function renderWithProviders(ui: React.ReactElement, initialEntries = ['/login']) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TenantContext.Provider
        value={{
          tenant: DEFAULT_TENANT,
          tenantSlug: DEFAULT_TENANT.identity.slug,
          status: 'resolved',
          availableTenants: Object.values(DEMO_TENANTS),
          switchTenant: vi.fn(),
          isFeatureEnabled: () => true,
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </TenantContext.Provider>
    </I18nextProvider>
  );
}

describe('LoginPage & OidcCallbackPage IAM Flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      sessionId: null,
      expiresAt: null,
      authMethod: null,
      provider: null,
      connectionMode: 'live',
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renders gateway health, auth tabs, and federated providers on LoginPage', async () => {
    vi.spyOn(iamApi, 'getGatewayHealth').mockResolvedValue({
      data: {
        gateway: 'api-gateway',
        version: '1.0.0',
        transport: 'grpc',
        status: 'healthy',
        uptimeSeconds: 120,
        timestamp: '2026-01-01T00:00:00Z',
        mappedServices: 10,
      },
      message: 'OK',
    });
    vi.spyOn(iamApi, 'getMultiTenancyConfig').mockResolvedValue({
      data: {
        enabled: true,
        mode: 'optional',
        defaultTenantId: 'default',
        tenantHeader: 'x-tenant-id',
        tenantSlugHeader: 'x-tenant-slug',
        subdomainEnabled: false,
      },
      message: 'OK',
    });
    vi.spyOn(iamApi, 'listPublicProviders').mockResolvedValue({
      data: [
        {
          id: 'p1',
          tenantId: 'default',
          slug: 'mock',
          providerType: 'MOCK',
          protocol: 'OIDC',
          displayName: 'Mock OIDC Dev',
          scopes: 'openid profile email',
          usePkce: true,
          authorizeUrl: '/api/v1/iam/oidc/mock/authorize',
          configSource: 'SYSTEM_DEFAULT',
          isSystemDefault: true,
          inheritsSystemConfig: false,
        },
        {
          id: 'p2',
          tenantId: 'default',
          slug: 'okta-saml',
          providerType: 'SAML',
          protocol: 'SAML',
          displayName: 'Corporate Okta SAML',
          scopes: 'openid profile email',
          usePkce: false,
          authorizeUrl: '/api/v1/iam/oidc/okta-saml/authorize',
          configSource: 'TENANT_CUSTOM',
          isSystemDefault: false,
          inheritsSystemConfig: false,
        },
      ],
      message: 'OK',
    });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard Home</div>} />
      </Routes>
    );

    await waitFor(() => {
      expect(screen.getByText(/Gateway Connected \(grpc\)/i)).toBeInTheDocument();
      expect(screen.getByText(/MT: optional/i)).toBeInTheDocument();
      expect(screen.getByText(/Mock OIDC Dev/i)).toBeInTheDocument();
      expect(screen.getByText(/Corporate Okta SAML/i)).toBeInTheDocument();
    });

    // Switch to Register tab and SSO Redeem tab
    fireEvent.click(screen.getByRole('tab', { name: /Register/i }));
    expect(screen.getByRole('button', { name: /Create IAM Account/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /SSO Redeem/i }));
    expect(screen.getByRole('button', { name: /Redeem SSO Handoff Code/i })).toBeInTheDocument();
  });

  it('submits credentials via iamApi.login and authenticates session', async () => {
    vi.spyOn(iamApi, 'getGatewayHealth').mockResolvedValue({
      data: {
        gateway: 'api-gateway',
        version: '1.0.0',
        transport: 'grpc',
        status: 'healthy',
        uptimeSeconds: 120,
        timestamp: '2026-01-01T00:00:00Z',
        mappedServices: 10,
      },
      message: 'OK',
    });
    vi.spyOn(iamApi, 'getMultiTenancyConfig').mockResolvedValue({
      data: {
        enabled: false,
        mode: 'disabled',
        defaultTenantId: 'default',
        tenantHeader: 'x-tenant-id',
        tenantSlugHeader: 'x-tenant-slug',
        subdomainEnabled: false,
      },
      message: 'OK',
    });
    vi.spyOn(iamApi, 'listPublicProviders').mockResolvedValue({ data: [], message: 'OK' });

    const loginSpy = vi.spyOn(iamApi, 'login').mockResolvedValue({
      data: {
        accessToken: makeMockToken('admin@enterprise.local', 'ADMIN'),
        refreshToken: 'ref_tok',
        expiresIn: 3600,
        tokenType: 'Bearer',
        sessionId: 'sso_sess_1',
        tenantId: 'default',
        authMethod: 'LOCAL',
        user: {
          id: 'usr_123',
          email: 'admin@enterprise.local',
          name: 'Test Admin',
          role: 'ADMIN',
          tenantId: 'default',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      },
      message: 'Login successful',
    });

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard Home</div>} />
      </Routes>
    );

    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.email).toBe('admin@enterprise.local');
      expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
    });
  });

  it('processes OidcCallbackPage query code & state via handleOidcCallback', async () => {
    const cbSpy = vi.spyOn(iamApi, 'handleOidcCallback').mockResolvedValue({
      data: {
        accessToken: makeMockToken('oidc.user@acme.io', 'SUPPORT'),
        refreshToken: 'ref_oidc',
        expiresIn: 3600,
        tokenType: 'Bearer',
        sessionId: 'sso_oidc_1',
        tenantId: 'default',
        authMethod: 'OIDC',
        provider: 'mock',
        user: {
          id: 'usr_oidc',
          email: 'oidc.user@acme.io',
          name: 'OIDC User',
          role: 'SUPPORT',
          tenantId: 'default',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      },
      message: 'Authenticated via OIDC',
    });

    renderWithProviders(
      <Routes>
        <Route path="/auth/callback/:provider" element={<OidcCallbackPage />} />
      </Routes>,
      ['/auth/callback/mock?code=auth_code_1&state=state_xyz']
    );

    await waitFor(() => {
      expect(cbSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mock',
          code: 'auth_code_1',
          state: 'state_xyz',
        })
      );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('SUPPORT');
      expect(screen.getByText(/oidc\.user@acme\.io/i)).toBeInTheDocument();
    });
  });
});
