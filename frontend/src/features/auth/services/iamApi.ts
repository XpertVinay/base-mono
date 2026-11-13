import { apiClient } from '../../../core/api/client';
import { ApiError } from '../../../core/api/types';
import { resolveServiceEndpoint } from '../../../core/config/serviceConfig';
import {
  AssociateSystemProviderPayload,
  AuthTokensDto,
  ConfigureOidcProviderPayload,
  CreateSsoHandoffPayload,
  CreateTenantPayload,
  ExchangeServiceTokenPayload,
  FederatedIdentityDto,
  GatewayHealthDto,
  IamUserDto,
  IntrospectedTokenDto,
  IntrospectTokenPayload,
  LoginRequestPayload,
  MiddlewareErrorPayload,
  MultiTenancyStatusDto,
  OidcAuthInitiationDto,
  OidcDiscoveryMetadata,
  OidcProviderDto,
  OidcProviderPublicDto,
  OidcProviderType,
  OnboardTenantPayload,
  OnboardTenantResult,
  RedeemSsoHandoffPayload,
  RefreshTokenPayload,
  RegisterRequestPayload,
  ServiceProviderTokenDto,
  SloLogoutPayload,
  SloResultDto,
  SsoHandoffCodeDto,
  SsoSessionDto,
  StandardApiEnvelope,
  StandardMetaData,
  TenantDto,
  TokenExchangePayload,
  UpdateTenantPayload,
} from '../types/iam.types';

export interface IamApiResult<T> {
  data: T;
  message: string;
  meta?: StandardMetaData;
}

export class IamApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly furtherSteps?: string[];

  constructor(message: string, status: number, code?: string, furtherSteps?: string[]) {
    super(message);
    this.name = 'IamApiError';
    this.status = status;
    this.code = code;
    this.furtherSteps = furtherSteps;
  }
}

export function extractIamError(err: unknown): IamApiError {
  if (err instanceof IamApiError) {
    return err;
  }

  if (err instanceof ApiError) {
    const details = err.details as Partial<StandardApiEnvelope & MiddlewareErrorPayload> | undefined;

    // Middleware error shape: { success: false, error: { code, message } }
    if (details && typeof details === 'object' && 'error' in details && details.error) {
      return new IamApiError(
        details.error.message || err.message,
        err.status,
        details.error.code
      );
    }

    // StandardResponse envelope error shape: { status: false, message, errors, meta_data }
    if (details && typeof details === 'object' && 'message' in details) {
      const firstErr = Array.isArray(details.errors) ? details.errors[0] : undefined;
      const code =
        typeof firstErr === 'object' && firstErr !== null && 'code' in firstErr
          ? String(firstErr.code)
          : undefined;
      return new IamApiError(
        String(details.message || err.message),
        err.status,
        code,
        details.meta_data?.further_steps ?? undefined
      );
    }

    return new IamApiError(err.message, err.status);
  }

  return new IamApiError(err instanceof Error ? err.message : 'Unexpected IAM error', 500);
}

function unwrapEnvelope<T>(raw: unknown, status: number): IamApiResult<T> {
  if (!raw || typeof raw !== 'object') {
    throw new IamApiError('Empty response from IAM API', status);
  }

  const body = raw as Partial<StandardApiEnvelope<T> & MiddlewareErrorPayload>;

  if (body.success === false && body.error) {
    throw new IamApiError(body.error.message, status, body.error.code);
  }

  if (body.status === false) {
    const firstErr = Array.isArray(body.errors) ? body.errors[0] : undefined;
    const code =
      typeof firstErr === 'object' && firstErr !== null && 'code' in firstErr
        ? String(firstErr.code)
        : undefined;
    throw new IamApiError(
      body.message || 'Request failed',
      status,
      code,
      body.meta_data?.further_steps ?? undefined
    );
  }

  return {
    data: (body.data !== undefined ? body.data : raw) as T,
    message: body.message || 'Success',
    meta: body.meta_data,
  };
}

export interface RequestContextOptions {
  token?: string;
  tenantId?: string;
  tenantSlug?: string;
}

const iamPath = (path: string): string => `${resolveServiceEndpoint('iam')}${path}`;
const healthPath = (): string => resolveServiceEndpoint('health');

export const iamApi = {
  // --- Gateway Health ---
  async getGatewayHealth(): Promise<IamApiResult<GatewayHealthDto>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<GatewayHealthDto>>(healthPath());
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  // --- Core Authentication (/api/v1/iam/*) ---
  async register(payload: RegisterRequestPayload, ctx: RequestContextOptions = {}): Promise<IamApiResult<IamUserDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<IamUserDto>>(iamPath('/register'), payload, {
        token: ctx.token,
        tenantId: payload.tenantId || ctx.tenantId,
        tenantSlug: payload.tenantSlug || ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async login(payload: LoginRequestPayload, ctx: RequestContextOptions = {}): Promise<IamApiResult<AuthTokensDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<AuthTokensDto>>(iamPath('/login'), payload, {
        tenantId: payload.tenantId || ctx.tenantId,
        tenantSlug: payload.tenantSlug || ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async refreshToken(payload: RefreshTokenPayload, ctx: RequestContextOptions = {}): Promise<IamApiResult<AuthTokensDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<AuthTokensDto>>(
        iamPath('/refresh'),
        { refreshToken: payload.refreshToken },
        {
          tenantId: payload.tenantId || ctx.tenantId,
          tenantSlug: ctx.tenantSlug,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async getProfile(ctx: RequestContextOptions): Promise<IamApiResult<IamUserDto>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<IamUserDto>>(iamPath('/profile'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async getUserById(userId: string, ctx: RequestContextOptions): Promise<IamApiResult<IamUserDto>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<IamUserDto>>(iamPath(`/users/${encodeURIComponent(userId)}`), {
        token: ctx.token,
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  // --- Multi-Tenancy & Authorization Policies (/api/v1/iam/tenants/*) ---
  async getMultiTenancyConfig(ctx: RequestContextOptions = {}): Promise<IamApiResult<MultiTenancyStatusDto>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<MultiTenancyStatusDto>>(iamPath('/tenants/config'), {
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async listTenants(ctx: RequestContextOptions): Promise<IamApiResult<TenantDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<TenantDto[]>>(iamPath('/tenants'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async getTenant(idOrSlug: string, ctx: RequestContextOptions): Promise<IamApiResult<TenantDto>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<TenantDto>>(iamPath(`/tenants/${encodeURIComponent(idOrSlug)}`), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async createTenant(payload: CreateTenantPayload, ctx: RequestContextOptions): Promise<IamApiResult<TenantDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<TenantDto>>(iamPath('/tenants'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async onboardTenant(
    payload: OnboardTenantPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OnboardTenantResult>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OnboardTenantResult>>(iamPath('/tenants/onboard'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async updateTenant(
    idOrSlug: string,
    payload: UpdateTenantPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<TenantDto>> {
    try {
      const res = await apiClient.patch<StandardApiEnvelope<TenantDto>>(
        iamPath(`/tenants/${encodeURIComponent(idOrSlug)}`),
        payload,
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  // --- Public Federated OIDC / OAuth2 / SAML Flows (/api/v1/iam/oidc/*) ---
  async listPublicProviders(ctx: RequestContextOptions = {}): Promise<IamApiResult<OidcProviderPublicDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<OidcProviderPublicDto[]>>(iamPath('/oidc/providers'), {
        tenantId: ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
        params: ctx.tenantSlug ? { tenantSlug: ctx.tenantSlug } : undefined,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async initiateOidcAuthorize(
    provider: string,
    options: {
      tenantId?: string;
      tenantSlug?: string;
      redirectUri?: string;
      clientRedirectUrl?: string;
      loginHint?: string;
    } = {}
  ): Promise<IamApiResult<OidcAuthInitiationDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcAuthInitiationDto>>(
        iamPath('/oidc/authorize'),
        { provider, ...options },
        {
          tenantId: options.tenantId,
          tenantSlug: options.tenantSlug,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async handleOidcCallback(params: {
    provider?: string;
    code?: string;
    state: string;
    error?: string;
    error_description?: string;
    SAMLResponse?: string;
    RelayState?: string;
  }): Promise<IamApiResult<AuthTokensDto>> {
    try {
      const basePath = params.provider
        ? iamPath(`/oidc/${encodeURIComponent(params.provider)}/callback`)
        : iamPath('/oidc/callback');

      if (params.SAMLResponse) {
        const res = await apiClient.post<StandardApiEnvelope<AuthTokensDto>>(basePath, {
          SAMLResponse: params.SAMLResponse,
          RelayState: params.RelayState || params.state,
          state: params.state,
        });
        return unwrapEnvelope(res.data, res.status);
      }

      const res = await apiClient.get<StandardApiEnvelope<AuthTokensDto>>(basePath, {
        params: {
          code: params.code,
          state: params.state,
          error: params.error,
          error_description: params.error_description,
        },
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async exchangeIdToken(
    payload: TokenExchangePayload,
    ctx: RequestContextOptions = {}
  ): Promise<IamApiResult<AuthTokensDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<AuthTokensDto>>(iamPath('/oidc/token-exchange'), payload, {
        tenantId: payload.tenantId || ctx.tenantId,
        tenantSlug: payload.tenantSlug || ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async initiateAccountLink(
    provider: string,
    options: { redirectUri?: string; clientRedirectUrl?: string },
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OidcAuthInitiationDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcAuthInitiationDto>>(
        iamPath(`/oidc/${encodeURIComponent(provider)}/link`),
        options,
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
          tenantSlug: ctx.tenantSlug,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async listFederatedIdentities(ctx: RequestContextOptions): Promise<IamApiResult<FederatedIdentityDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<FederatedIdentityDto[]>>(iamPath('/federated-identities'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async unlinkFederatedIdentity(id: string, ctx: RequestContextOptions): Promise<IamApiResult<{ unlinked: boolean }>> {
    try {
      const res = await apiClient.delete<StandardApiEnvelope<{ unlinked: boolean }>>(
        iamPath(`/federated-identities/${encodeURIComponent(id)}`),
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  // --- Admin Federation Provider Management (/api/v1/iam/oidc/admin/*) ---
  async listSupportedProviderTypes(ctx: RequestContextOptions): Promise<IamApiResult<OidcProviderType[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<OidcProviderType[]>>(iamPath('/oidc/admin/supported-types'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminListProviders(
    ctx: RequestContextOptions & { includeSystemDefaults?: boolean; targetTenantId?: string; targetTenantSlug?: string }
  ): Promise<IamApiResult<OidcProviderDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<OidcProviderDto[]>>(iamPath('/oidc/admin/providers'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
        params: {
          includeSystemDefaults: ctx.includeSystemDefaults ? 'true' : 'false',
          tenantId: ctx.targetTenantId,
          tenantSlug: ctx.targetTenantSlug,
        },
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminListPendingApprovals(ctx: RequestContextOptions): Promise<IamApiResult<OidcProviderDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<OidcProviderDto[]>>(iamPath('/oidc/admin/providers/pending'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminConfigureProvider(
    payload: ConfigureOidcProviderPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OidcProviderDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcProviderDto>>(iamPath('/oidc/admin/providers'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminAssociateSystemProvider(
    payload: AssociateSystemProviderPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OidcProviderDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcProviderDto>>(
        iamPath('/oidc/admin/providers/associate'),
        payload,
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminUpdateProvider(
    id: string,
    payload: Partial<ConfigureOidcProviderPayload>,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OidcProviderDto>> {
    try {
      const res = await apiClient.patch<StandardApiEnvelope<OidcProviderDto>>(
        iamPath(`/oidc/admin/providers/${encodeURIComponent(id)}`),
        payload,
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminDeleteProvider(
    id: string,
    ctx: RequestContextOptions & { targetTenantId?: string; targetTenantSlug?: string }
  ): Promise<IamApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<StandardApiEnvelope<{ deleted: boolean }>>(
        iamPath(`/oidc/admin/providers/${encodeURIComponent(id)}`),
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
          params: {
            tenantId: ctx.targetTenantId,
            tenantSlug: ctx.targetTenantSlug,
          },
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminTestDiscovery(
    id: string,
    ctx: RequestContextOptions & { targetTenantId?: string; targetTenantSlug?: string }
  ): Promise<IamApiResult<OidcDiscoveryMetadata>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcDiscoveryMetadata>>(
        iamPath(`/oidc/admin/providers/${encodeURIComponent(id)}/test-discovery`),
        {},
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
          params: {
            tenantId: ctx.targetTenantId,
            tenantSlug: ctx.targetTenantSlug,
          },
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminApproveProvider(id: string, ctx: RequestContextOptions): Promise<IamApiResult<OidcProviderDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcProviderDto>>(
        iamPath(`/oidc/admin/providers/${encodeURIComponent(id)}/approve`),
        {},
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async adminRejectProvider(
    id: string,
    reason: string | undefined,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<OidcProviderDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<OidcProviderDto>>(
        iamPath(`/oidc/admin/providers/${encodeURIComponent(id)}/reject`),
        { reason },
        {
          token: ctx.token,
          tenantId: ctx.tenantId,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  // --- Internal SSO, Handoff, Service Token Exchange, Introspection & SLO (/api/v1/iam/sso/*) ---
  async createSsoHandoff(
    payload: CreateSsoHandoffPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<SsoHandoffCodeDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<SsoHandoffCodeDto>>(iamPath('/sso/handoff'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async redeemSsoHandoff(
    payload: RedeemSsoHandoffPayload,
    ctx: RequestContextOptions = {}
  ): Promise<IamApiResult<ServiceProviderTokenDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<ServiceProviderTokenDto>>(iamPath('/sso/redeem'), payload, {
        tenantId: payload.expectedTenantId || ctx.tenantId,
        tenantSlug: ctx.tenantSlug,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async exchangeServiceToken(
    payload: ExchangeServiceTokenPayload,
    ctx: RequestContextOptions
  ): Promise<IamApiResult<ServiceProviderTokenDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<ServiceProviderTokenDto>>(iamPath('/sso/exchange'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async introspectToken(
    payload: IntrospectTokenPayload,
    ctx: RequestContextOptions = {}
  ): Promise<IamApiResult<IntrospectedTokenDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<IntrospectedTokenDto>>(iamPath('/sso/introspect'), payload, {
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async listSsoSessions(ctx: RequestContextOptions): Promise<IamApiResult<SsoSessionDto[]>> {
    try {
      const res = await apiClient.get<StandardApiEnvelope<SsoSessionDto[]>>(iamPath('/sso/sessions'), {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async ssoLogout(payload: SloLogoutPayload, ctx: RequestContextOptions): Promise<IamApiResult<SloResultDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<SloResultDto>>(iamPath('/sso/logout'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async oidcLogout(payload: SloLogoutPayload, ctx: RequestContextOptions): Promise<IamApiResult<SloResultDto>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<SloResultDto>>(iamPath('/oidc/logout'), payload, {
        token: ctx.token,
        tenantId: ctx.tenantId,
      });
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },

  async triggerBackchannelLogout(
    provider: string,
    logoutToken: string,
    ctx: RequestContextOptions = {}
  ): Promise<IamApiResult<{ revokedSessions: number }>> {
    try {
      const res = await apiClient.post<StandardApiEnvelope<{ revokedSessions: number }>>(
        iamPath(`/oidc/${encodeURIComponent(provider)}/backchannel-logout`),
        { logout_token: logoutToken },
        {
          tenantId: ctx.tenantId,
          tenantSlug: ctx.tenantSlug,
        }
      );
      return unwrapEnvelope(res.data, res.status);
    } catch (err) {
      throw extractIamError(err);
    }
  },
};

