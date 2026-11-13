import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ApproveOidcProviderUseCase,
  AssociateSystemProviderUseCase,
  ConfigureOidcProviderUseCase,
  DeleteOidcProviderUseCase,
  ListOidcProvidersAdminQuery,
  ListPendingOidcProvidersQuery,
  ListTenantOidcProvidersQuery,
  RejectOidcProviderUseCase,
  TestOidcProviderDiscoveryUseCase,
  UpdateOidcProviderUseCase
} from '../../application/commands/oidc-provider.use-cases.js';
import {
  ExchangeOidcIdTokenUseCase,
  HandleOidcCallbackUseCase,
  InitiateOidcLoginUseCase,
  ListMyFederatedIdentitiesQuery,
  UnlinkFederatedIdentityUseCase
} from '../../application/commands/federated-auth.use-cases.js';
import {
  CreateSsoHandoffCodeUseCase,
  HandleBackchannelLogoutUseCase,
  InitiateSloLogoutUseCase
} from '../../application/commands/sso.use-cases.js';
import { IOidcProviderRegistry } from '../../application/ports/oidc-provider-adapter.port.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';
import { getMultiTenancyConfig } from '../../shared/presentation/tenant.middleware.js';

const providerTypeEnum = z.enum([
  'GENERIC_OIDC',
  'GENERIC_OAUTH2',
  'GOOGLE',
  'ENTRA_ID',
  'OKTA',
  'KEYCLOAK',
  'SAML',
  'MOCK'
]);

const protocolEnum = z.enum(['OIDC', 'OAUTH2', 'SAML']);

const samlConfigSchema = z.object({
  idpEntityId: z.string().min(1).optional(),
  idpSsoUrl: z.string().url().optional(),
  idpSloUrl: z.string().url().optional(),
  spEntityId: z.string().min(1).optional(),
  idpCertificatePem: z.string().min(10).optional(),
  nameIdFormat: z.string().min(1).optional(),
  signAuthnRequest: z.boolean().optional()
});

const createProviderSchema = z.object({
  tenantId: z.string().min(1).max(64).optional(),
  tenantSlug: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,99}$/),
  providerType: providerTypeEnum.default('GENERIC_OIDC'),
  protocol: protocolEnum.optional(),
  displayName: z.string().min(2).max(255),
  issuerUrl: z.string().url(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  userinfoEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  endSessionEndpoint: z.string().url().optional(),
  clientId: z.string().min(1).max(255),
  clientSecret: z.string().min(1).max(1024).optional(),
  redirectUri: z.string().url(),
  allowedRedirectUris: z.array(z.string().url()).optional(),
  scopes: z.string().min(1).max(500).optional(),
  usePkce: z.boolean().optional(),
  autoProvision: z.boolean().optional(),
  allowedDomains: z.array(z.string().min(1)).optional(),
  claimMapping: z.record(z.string()).optional(),
  roleMapping: z.record(z.string()).optional(),
  extraAuthParams: z.record(z.string()).optional(),
  samlConfig: samlConfigSchema.optional(),
  isSystemDefault: z.boolean().optional(),
  inheritsSystemConfig: z.boolean().optional(),
  parentProviderId: z.string().optional(),
  isEnabled: z.boolean().optional()
});

const associateProviderSchema = z.object({
  tenantId: z.string().min(1).max(64).optional(),
  tenantSlug: z.string().min(1).max(100).optional(),
  systemProvider: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,99}$/).optional(),
  displayName: z.string().min(2).max(255).optional(),
  issuerUrl: z.string().url().optional(),
  authorizationEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  userinfoEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  endSessionEndpoint: z.string().url().optional(),
  clientId: z.string().min(1).max(255).optional(),
  clientSecret: z.string().min(1).max(1024).optional(),
  redirectUri: z.string().url().optional(),
  allowedRedirectUris: z.array(z.string().url()).optional(),
  scopes: z.string().min(1).max(500).optional(),
  autoProvision: z.boolean().optional(),
  allowedDomains: z.array(z.string().min(1)).optional(),
  claimMapping: z.record(z.string()).optional(),
  roleMapping: z.record(z.string()).optional(),
  extraAuthParams: z.record(z.string()).optional(),
  samlConfig: samlConfigSchema.optional(),
  inheritsSystemConfig: z.boolean().optional(),
  isEnabled: z.boolean().optional()
});

const updateProviderSchema = createProviderSchema
  .omit({ slug: true })
  .partial();

const initiateAuthSchema = z.object({
  provider: z.string().min(1),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  redirectUri: z.string().url().optional(),
  clientRedirectUrl: z.string().url().optional(),
  loginHint: z.string().optional()
});

const tokenExchangeSchema = z.object({
  provider: z.string().min(1),
  idToken: z.string().min(10),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  nonce: z.string().optional()
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional()
});

export class OidcController {
  constructor(
    private readonly configureProviderUseCase: ConfigureOidcProviderUseCase,
    private readonly updateProviderUseCase: UpdateOidcProviderUseCase,
    private readonly deleteProviderUseCase: DeleteOidcProviderUseCase,
    private readonly listProvidersAdminQuery: ListOidcProvidersAdminQuery,
    private readonly listTenantProvidersQuery: ListTenantOidcProvidersQuery,
    private readonly testDiscoveryUseCase: TestOidcProviderDiscoveryUseCase,
    private readonly initiateLoginUseCase: InitiateOidcLoginUseCase,
    private readonly handleCallbackUseCase: HandleOidcCallbackUseCase,
    private readonly exchangeIdTokenUseCase: ExchangeOidcIdTokenUseCase,
    private readonly listFederatedQuery: ListMyFederatedIdentitiesQuery,
    private readonly unlinkFederatedUseCase: UnlinkFederatedIdentityUseCase,
    private readonly oidcRegistry: IOidcProviderRegistry,
    private readonly associateSystemProviderUseCase?: AssociateSystemProviderUseCase,
    private readonly approveProviderUseCase?: ApproveOidcProviderUseCase,
    private readonly rejectProviderUseCase?: RejectOidcProviderUseCase,
    private readonly listPendingProvidersQuery?: ListPendingOidcProvidersQuery,
    private readonly initiateSloLogoutUseCase?: InitiateSloLogoutUseCase,
    private readonly backchannelLogoutUseCase?: HandleBackchannelLogoutUseCase,
    private readonly createSsoHandoffUseCase?: CreateSsoHandoffCodeUseCase
  ) {}

  private resolveAdminTargetTenant(
    req: Request,
    explicitTenantId?: string,
    explicitTenantSlug?: string
  ): { tenantId?: string; tenantSlug?: string } {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !req.user?.tenantId || req.user.tenantId === defaultTenantId;

    if (explicitTenantId || explicitTenantSlug) {
      return { tenantId: explicitTenantId, tenantSlug: explicitTenantSlug };
    }
    if (req.tenant?.isDefault === false) {
      return { tenantId: req.tenant.tenantId, tenantSlug: req.tenant.tenantSlug };
    }
    return {
      tenantId: isPlatformAdmin ? req.user?.tenantId : req.user?.tenantId,
      tenantSlug: req.tenant?.tenantSlug
    };
  }

  listPublicProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenant?.tenantId;
      const tenantSlug = req.tenant?.tenantSlug;
      const result = await this.listTenantProvidersQuery.execute({ tenantId, tenantSlug });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Enabled federation providers retrieved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  authorizeGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const provider = (req.params.provider || req.query.provider) as string;
      if (!provider) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: 'OIDC provider identifier is required',
          errors: [{ code: 'MISSING_PROVIDER', message: 'Provide :provider route param or ?provider=' }]
        });
        return;
      }

      const qTenantId = req.query.tenantId as string | undefined;
      const qTenantSlug = req.query.tenantSlug as string | undefined;
      const result = await this.initiateLoginUseCase.execute({
        provider,
        tenantId: qTenantId || (qTenantSlug ? undefined : req.tenant?.tenantId),
        tenantSlug: qTenantSlug || (qTenantId ? undefined : req.tenant?.tenantSlug),
        redirectUri: req.query.redirectUri as string | undefined,
        clientRedirectUrl: req.query.clientRedirectUrl as string | undefined,
        loginHint: req.query.loginHint as string | undefined
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'OIDC_INITIATION_FAILED', message: result.getError() }]
        });
        return;
      }

      const payload = result.getValue();
      if (req.query.redirect === 'true') {
        res.redirect(302, payload.authorizationUrl);
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC authorization URL generated',
        data: payload,
        meta: {
          further_steps: [
            'Redirect user-agent to data.authorizationUrl',
            'Handle IdP callback at GET/POST /api/v1/iam/oidc/callback with code & state'
          ]
        }
      });
    } catch (err) {
      next(err);
    }
  };

  authorizePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = initiateAuthSchema.parse(req.body);
      const result = await this.initiateLoginUseCase.execute({
        ...validated,
        tenantId: validated.tenantId || (validated.tenantSlug ? undefined : req.tenant?.tenantId),
        tenantSlug: validated.tenantSlug || (validated.tenantId ? undefined : req.tenant?.tenantSlug)
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'OIDC_INITIATION_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC authorization URL generated',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  initiateLink = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Sign in first to link a federated provider' }]
        });
        return;
      }

      const provider = req.params.provider as string;
      const result = await this.initiateLoginUseCase.execute({
        provider,
        tenantId: req.user.tenantId,
        tenantSlug: req.user.tenantSlug,
        redirectUri: req.body?.redirectUri,
        clientRedirectUrl: req.body?.clientRedirectUrl,
        linkUserId: req.user.id
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'OIDC_LINK_INITIATION_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Federated account linking URL generated',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  callback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const source = req.method === 'POST' ? req.body : req.query;
      const state = String(source?.state || source?.RelayState || '');
      const code = source?.code
        ? String(source.code)
        : source?.SAMLResponse
          ? String(source.SAMLResponse)
          : undefined;

      const result = await this.handleCallbackUseCase.execute({
        state,
        code,
        error: source?.error ? String(source.error) : undefined,
        errorDescription: source?.error_description ? String(source.error_description) : undefined,
        provider: req.params.provider as string | undefined
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: result.getError(),
          errors: [{ code: 'OIDC_CALLBACK_FAILED', message: result.getError() }],
          meta: { further_steps: ['Re-initiate OIDC login at GET /api/v1/iam/oidc/:provider/authorize'] }
        });
        return;
      }

      const tokens = result.getValue();
      if (
        (req.query.redirect === 'true' || source?.redirect === 'true') &&
        tokens.redirectUrl &&
        tokens.sessionId &&
        tokens.user &&
        this.createSsoHandoffUseCase
      ) {
        const handoff = await this.createSsoHandoffUseCase.execute({
          sessionId: tokens.sessionId,
          userId: tokens.user.id,
          tenantId: tokens.tenantId || tokens.user.tenantId || 'default',
          targetService: String(req.query.targetService || 'client-app'),
          redirectUri: tokens.redirectUrl
        });
        if (handoff.isSuccess && handoff.getValue().redirectUrl) {
          res.redirect(302, handoff.getValue().redirectUrl!);
          return;
        }
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Federated authentication successful',
        data: tokens,
        meta: { further_steps: ['Pass data.accessToken in the Authorization: Bearer <token> header'] }
      });
    } catch (err) {
      next(err);
    }
  };

  tokenExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = tokenExchangeSchema.parse(req.body);
      const result = await this.exchangeIdTokenUseCase.execute({
        ...validated,
        tenantId: validated.tenantId || (validated.tenantSlug ? undefined : req.tenant?.tenantId),
        tenantSlug: validated.tenantSlug || (validated.tenantId ? undefined : req.tenant?.tenantSlug)
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: result.getError(),
          errors: [{ code: 'OIDC_TOKEN_EXCHANGE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC ID token exchanged for platform session tokens',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Sign in first to perform Single Logout' }]
        });
        return;
      }
      if (!this.initiateSloLogoutUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'SLO logout use case not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'SLO not configured' }]
        });
        return;
      }

      const source = req.method === 'POST' ? req.body : req.query;
      const result = await this.initiateSloLogoutUseCase.execute({
        sessionId: req.user.sessionId || (source?.sessionId ? String(source.sessionId) : undefined),
        userId: req.user.id,
        tenantId: req.user.tenantId,
        allSessions: source?.allSessions === true || source?.allSessions === 'true',
        postLogoutRedirectUri: source?.postLogoutRedirectUri ? String(source.postLogoutRedirectUri) : undefined,
        state: source?.state ? String(source.state) : undefined
      });

      const slo = result.getValue();
      if ((req.query.redirect === 'true' || source?.redirect === 'true') && slo.idpLogoutUrl) {
        res.redirect(302, slo.idpLogoutUrl);
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Single Logout (SLO) completed and session revoked',
        data: slo
      });
    } catch (err) {
      next(err);
    }
  };

  backchannelLogout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.backchannelLogoutUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Back-channel logout not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Back-channel logout unavailable' }]
        });
        return;
      }

      const logoutToken = String(req.body?.logout_token || req.body?.logoutToken || '');
      if (!logoutToken) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: 'Missing logout_token parameter',
          errors: [{ code: 'MISSING_LOGOUT_TOKEN', message: 'Provide logout_token in request body' }]
        });
        return;
      }

      const result = await this.backchannelLogoutUseCase.execute({
        provider: req.params.provider as string,
        logoutToken,
        tenantId: req.tenant?.tenantId,
        tenantSlug: req.tenant?.tenantSlug
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'BACKCHANNEL_LOGOUT_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Back-channel logout processed',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listMyFederatedIdentities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
        return;
      }

      const result = await this.listFederatedQuery.execute({
        userId: req.user.id,
        tenantId: req.user.tenantId
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Linked federated identities retrieved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  unlinkFederatedIdentity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
        return;
      }

      const result = await this.unlinkFederatedUseCase.execute({
        id: req.params.id as string,
        userId: req.user.id,
        tenantId: req.user.tenantId
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'UNLINK_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Federated identity unlinked successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  // --- Admin Provider Management ---

  listSupportedTypes = async (req: Request, res: Response): Promise<void> => {
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Supported federation provider adapter types',
      data: this.oidcRegistry.listSupportedTypes()
    });
  };

  adminListProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const target = this.resolveAdminTargetTenant(
        req,
        req.query.tenantId as string | undefined,
        req.query.tenantSlug as string | undefined
      );
      const result = await this.listProvidersAdminQuery.execute({
        ...target,
        actorTenantId: req.user?.tenantId,
        includeSystemDefaults: req.query.includeSystemDefaults === 'true'
      });

      if (result.isFailure) {
        const msg = result.getError();
        ApiResponse.error(res, {
          req,
          statusCode: msg.includes('different tenant') ? 403 : 404,
          message: msg,
          errors: [{ code: msg.includes('different tenant') ? 'FORBIDDEN' : 'TENANT_NOT_FOUND', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Federation providers retrieved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminListPendingApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.listPendingProvidersQuery) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Pending approvals query not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Approval workflow not configured' }]
        });
        return;
      }

      const result = await this.listPendingProvidersQuery.execute({
        actorTenantId: req.user?.tenantId
      });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 403,
          message: result.getError(),
          errors: [{ code: 'FORBIDDEN', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Pending tenant federation overrides retrieved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminConfigureProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createProviderSchema.parse(req.body);
      const target = this.resolveAdminTargetTenant(req, validated.tenantId, validated.tenantSlug);
      const result = await this.configureProviderUseCase.execute({
        ...validated,
        ...target,
        actorUserId: req.user?.id,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('different tenant') || msg.includes('Only platform administrators');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 400,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'OIDC_PROVIDER_CREATE_FAILED', message: msg }]
        });
        return;
      }

      const created = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message:
          created.approvalStatus === 'PENDING'
            ? 'Tenant provider override submitted and awaiting platform approval'
            : 'Federation provider configured successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  };

  adminAssociateSystemProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.associateSystemProviderUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'System provider association not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Association not configured' }]
        });
        return;
      }

      const validated = associateProviderSchema.parse(req.body);
      const target = this.resolveAdminTargetTenant(req, validated.tenantId, validated.tenantSlug);
      const result = await this.associateSystemProviderUseCase.execute({
        ...validated,
        ...target,
        actorUserId: req.user?.id,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('different tenant');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 400,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'PROVIDER_ASSOCIATION_FAILED', message: msg }]
        });
        return;
      }

      const created = result.getValue();
      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message:
          created.approvalStatus === 'PENDING'
            ? 'Tenant provider override associated and pending platform approval'
            : 'System provider associated with tenant successfully',
        data: created
      });
    } catch (err) {
      next(err);
    }
  };

  adminApproveProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.approveProviderUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Provider approval not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Approval workflow not configured' }]
        });
        return;
      }

      const result = await this.approveProviderUseCase.execute({
        id: req.params.id as string,
        tenantId: (req.body?.tenantId || req.query.tenantId) as string | undefined,
        tenantSlug: (req.body?.tenantSlug || req.query.tenantSlug) as string | undefined,
        approvedBy: req.user?.id || 'platform-admin',
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('Only platform administrators');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 404,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'PROVIDER_APPROVAL_FAILED', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenant federation provider override approved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminRejectProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.rejectProviderUseCase) {
        ApiResponse.error(res, {
          req,
          statusCode: 501,
          message: 'Provider rejection not configured',
          errors: [{ code: 'NOT_IMPLEMENTED', message: 'Rejection workflow not configured' }]
        });
        return;
      }

      const validated = rejectSchema.parse(req.body || {});
      const result = await this.rejectProviderUseCase.execute({
        id: req.params.id as string,
        tenantId: validated.tenantId || (req.query.tenantId as string | undefined),
        tenantSlug: validated.tenantSlug || (req.query.tenantSlug as string | undefined),
        rejectedBy: req.user?.id || 'platform-admin',
        reason: validated.reason,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('Only platform administrators');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 404,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'PROVIDER_REJECTION_FAILED', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Tenant federation provider override rejected',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminUpdateProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = updateProviderSchema.parse(req.body);
      const target = this.resolveAdminTargetTenant(req, validated.tenantId, validated.tenantSlug);
      const result = await this.updateProviderUseCase.execute({
        id: req.params.id as string,
        ...validated,
        ...target,
        actorUserId: req.user?.id,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('different tenant');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 404,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'OIDC_PROVIDER_UPDATE_FAILED', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC provider updated successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminDeleteProvider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const target = this.resolveAdminTargetTenant(
        req,
        req.query.tenantId as string | undefined,
        req.query.tenantSlug as string | undefined
      );
      const result = await this.deleteProviderUseCase.execute({
        id: req.params.id as string,
        ...target,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('different tenant');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 404,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'OIDC_PROVIDER_DELETE_FAILED', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC provider deleted successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  adminTestDiscovery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const target = this.resolveAdminTargetTenant(
        req,
        req.query.tenantId as string | undefined,
        req.query.tenantSlug as string | undefined
      );
      const result = await this.testDiscoveryUseCase.execute({
        id: req.params.id as string,
        ...target,
        actorTenantId: req.user?.tenantId
      });

      if (result.isFailure) {
        const msg = result.getError();
        const isForbidden = msg.includes('different tenant');
        ApiResponse.error(res, {
          req,
          statusCode: isForbidden ? 403 : 400,
          message: msg,
          errors: [{ code: isForbidden ? 'FORBIDDEN' : 'OIDC_DISCOVERY_FAILED', message: msg }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'OIDC discovery metadata verified',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
