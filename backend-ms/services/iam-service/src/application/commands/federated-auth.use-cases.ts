import crypto from 'crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import { IFederatedIdentityRepository } from '../../domain/repositories/federated-identity-repository.interface.js';
import { IOidcAuthStateRepository } from '../../domain/repositories/oidc-auth-state-repository.interface.js';
import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import { FederatedIdentity } from '../../domain/entities/federated-identity.entity.js';
import { SsoSession } from '../../domain/entities/sso-session.entity.js';
import { CryptoService } from '../../shared/infrastructure/crypto.service.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { AuthTokensDto, FederatedIdentityDto, OidcAuthInitiationDto } from '../../shared/contracts/index.js';
import { TenantResolverService } from '../services/tenant-resolver.service.js';
import { ProviderResolverService } from '../services/provider-resolver.service.js';
import { IOidcProviderRegistry, NormalizedOidcClaims } from '../ports/oidc-provider-adapter.port.js';
import { ITokenService } from '../ports/token-service.port.js';

function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface InitiateOidcLoginCommand {
  provider: string;
  tenantId?: string;
  tenantSlug?: string;
  redirectUri?: string;
  clientRedirectUrl?: string;
  loginHint?: string;
  linkUserId?: string;
}

export class InitiateOidcLoginUseCase implements UseCase<InitiateOidcLoginCommand, OidcAuthInitiationDto> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly tenantResolver: TenantResolverService,
    providerRepo: IOidcProviderRepository,
    private readonly authStateRepo: IOidcAuthStateRepository,
    private readonly oidcRegistry: IOidcProviderRegistry
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: InitiateOidcLoginCommand): Promise<Result<OidcAuthInitiationDto>> {
    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found or invalid tenant identifier');
    }
    if (!tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }
    if (!tenant.config.allowFederatedLogin) {
      return Result.fail('Federated OIDC login is disabled for this tenant');
    }

    const { provider, error } = await this.providerResolver.resolveForAuth(tenant.id, command.provider);
    if (!provider) {
      return Result.fail(error || `OIDC provider '${command.provider}' not found or disabled for tenant '${tenant.slug}'`);
    }

    const redirectUri = command.redirectUri || provider.redirectUri;
    if (command.redirectUri && !provider.isRedirectUriAllowed(command.redirectUri)) {
      return Result.fail('Requested redirectUri is not in the provider allowed redirect URI list');
    }

    if (command.clientRedirectUrl && !isSafeHttpUrl(command.clientRedirectUrl)) {
      return Result.fail('Invalid clientRedirectUrl: must use http or https scheme');
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const ttlMs = parseInt(process.env.OIDC_STATE_TTL_MS || '600000', 10);
    const expiresAt = new Date(Date.now() + ttlMs);

    await this.authStateRepo.save({
      state,
      tenantId: tenant.id,
      providerId: provider.id,
      nonce,
      codeVerifier,
      redirectUri,
      clientRedirectUrl: command.clientRedirectUrl,
      linkUserId: command.linkUserId,
      expiresAt,
      createdAt: new Date()
    });

    const adapter = this.oidcRegistry.getAdapter(provider.providerType);
    const authorizationUrl = await adapter.buildAuthorizationUrl({
      provider,
      state,
      nonce,
      codeChallenge: provider.usePkce ? codeChallenge : undefined,
      redirectUri,
      loginHint: command.loginHint
    });

    return Result.ok({
      authorizationUrl,
      state,
      provider: provider.slug,
      tenantId: tenant.id,
      expiresAt: expiresAt.toISOString()
    });
  }
}

export interface HandleOidcCallbackCommand {
  state: string;
  code?: string;
  error?: string;
  errorDescription?: string;
  provider?: string;
}

export class HandleOidcCallbackUseCase implements UseCase<HandleOidcCallbackCommand, AuthTokensDto> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly tenantRepo: ITenantRepository,
    providerRepo: IOidcProviderRepository,
    private readonly userRepo: IUserRepository,
    private readonly federatedRepo: IFederatedIdentityRepository,
    private readonly authStateRepo: IOidcAuthStateRepository,
    private readonly oidcRegistry: IOidcProviderRegistry,
    private readonly tokenService: ITokenService,
    private readonly ssoSessionRepo?: ISsoSessionRepository
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: HandleOidcCallbackCommand): Promise<Result<AuthTokensDto>> {
    if (command.error) {
      return Result.fail(`Identity provider returned error: ${command.errorDescription || command.error}`);
    }
    if (!command.state || !command.code) {
      return Result.fail('Missing required OIDC callback parameters (state and code)');
    }

    const authState = await this.authStateRepo.consume(command.state);
    if (!authState) {
      return Result.fail('Invalid, expired, or already consumed OIDC state');
    }
    if (authState.expiresAt.getTime() < Date.now()) {
      return Result.fail('OIDC authentication state has expired; please initiate login again');
    }

    const tenant = await this.tenantRepo.findById(authState.tenantId);
    if (!tenant || !tenant.isActive) {
      return Result.fail('Tenant not found or inactive');
    }
    if (!tenant.config.allowFederatedLogin) {
      return Result.fail('Federated login is disabled for this tenant');
    }

    const { provider, error: providerErr } = await this.providerResolver.resolveForAuthById(
      authState.providerId,
      tenant.id
    );
    if (!provider || !provider.isActiveForAuth()) {
      return Result.fail(providerErr || 'OIDC provider is unavailable, disabled, or pending approval');
    }
    if (command.provider && command.provider !== provider.slug && command.provider !== provider.id) {
      return Result.fail('OIDC callback provider mismatch');
    }

    const clientSecret = provider.clientSecretEncrypted
      ? CryptoService.decrypt(provider.clientSecretEncrypted)
      : undefined;

    const adapter = this.oidcRegistry.getAdapter(provider.providerType);
    const tokenSet = await adapter.exchangeCode({
      provider,
      code: command.code,
      codeVerifier: provider.usePkce ? authState.codeVerifier : undefined,
      redirectUri: authState.redirectUri,
      clientSecret,
      nonce: authState.nonce,
      expectedState: authState.state
    });

    let claims: NormalizedOidcClaims;
    if (tokenSet.idToken) {
      claims = await adapter.verifyIdTokenAndExtractClaims({
        provider,
        idToken: tokenSet.idToken,
        expectedNonce: authState.nonce,
        accessToken: tokenSet.accessToken,
        clientSecret
      });
    } else if (provider.protocol === 'OAUTH2' && tokenSet.accessToken && adapter.extractClaimsFromAccessToken) {
      claims = await adapter.extractClaimsFromAccessToken({
        provider,
        accessToken: tokenSet.accessToken
      });
    } else {
      return Result.fail('Identity provider did not return an id_token');
    }

    if (!claims.email) {
      return Result.fail('OIDC provider claims did not include an email address');
    }
    if (!provider.isEmailDomainAllowed(claims.email) || !tenant.isEmailDomainAllowed(claims.email)) {
      return Result.fail('Email domain is not permitted by tenant/provider policy');
    }

    let user: User | null = null;
    let isNewUser = false;

    const existingFed = await this.federatedRepo.findBySubject(tenant.id, provider.id, claims.subject);

    if (authState.linkUserId) {
      if (existingFed && existingFed.userId !== authState.linkUserId) {
        return Result.fail('This external identity is already linked to another user in this tenant');
      }
      user = await this.userRepo.findById(authState.linkUserId, tenant.id);
      if (!user || !user.isActive) {
        return Result.fail('Target user account for linking not found or inactive');
      }
      if (existingFed) {
        existingFed.recordLogin(claims.email, claims.rawClaims);
        await this.federatedRepo.update(existingFed);
      } else {
        const fed = FederatedIdentity.create({
          tenantId: tenant.id,
          userId: user.id,
          providerId: provider.id,
          providerSlug: provider.slug,
          subject: claims.subject,
          email: claims.email,
          profile: claims.rawClaims
        });
        await this.federatedRepo.save(fed);
        user.markFederatedLinked();
        await this.userRepo.update(user);
      }
    } else if (existingFed) {
      user = await this.userRepo.findById(existingFed.userId, tenant.id);
      if (!user) {
        return Result.fail('Linked user record no longer exists');
      }
      if (!user.isActive) {
        return Result.fail('User account has been disabled');
      }
      existingFed.recordLogin(claims.email, claims.rawClaims);
      await this.federatedRepo.update(existingFed);
      user.updateProfileFromFederation(claims.name);
      await this.userRepo.update(user);
    } else {
      user = await this.userRepo.findByEmail(claims.email, tenant.id);

      if (user) {
        if (!user.isActive) {
          return Result.fail('User account has been disabled');
        }
        if (!claims.emailVerified) {
          return Result.fail('Cannot auto-link unverified federated email to existing account');
        }
        user.markFederatedLinked();
        await this.userRepo.update(user);
      } else {
        if (!provider.autoProvision || !tenant.config.autoProvisionUsers) {
          return Result.fail('Auto-provisioning is disabled; an administrator must provision this user first');
        }
        const resolvedRole = provider.resolveRole(claims.externalRoles, tenant.config.defaultRole || 'USER');
        user = User.create({
          tenantId: tenant.id,
          email: claims.email,
          name: claims.name || claims.email.split('@')[0],
          role: resolvedRole,
          authMethod: 'OIDC'
        });
        await this.userRepo.save(user);
        isNewUser = true;

        await rabbitmq.publish('iam.user_registered', {
          id: crypto.randomUUID(),
          eventName: 'iam.user_registered',
          aggregateId: user.id,
          occurredAt: new Date().toISOString(),
          tenantId: tenant.id,
          payload: {
            userId: user.id,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            email: user.email,
            name: user.name,
            role: user.role,
            authMethod: 'OIDC',
            provider: provider.slug,
            protocol: provider.protocol
          },
          version: 1
        });
      }

      const fed = FederatedIdentity.create({
        tenantId: tenant.id,
        userId: user.id,
        providerId: provider.id,
        providerSlug: provider.slug,
        subject: claims.subject,
        email: claims.email,
        profile: claims.rawClaims
      });
      await this.federatedRepo.save(fed);
    }

    let sessionId: string | undefined;
    let refreshTokenJti: string | undefined;
    if (this.ssoSessionRepo) {
      const session = SsoSession.create({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        authMethod: user.authMethod === 'LOCAL' ? 'OIDC' : user.authMethod,
        providerId: provider.id,
        providerSlug: provider.slug,
        federatedSub: claims.subject,
        idTokenHintEncrypted: tokenSet.idToken ? CryptoService.encrypt(tokenSet.idToken) : undefined,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await this.ssoSessionRepo.save(session);
      sessionId = session.id;
      refreshTokenJti = session.refreshTokenJti;
    }

    await rabbitmq.publish('iam.federated_login_succeeded', {
      id: crypto.randomUUID(),
      eventName: 'iam.federated_login_succeeded',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        userId: user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: user.email,
        providerId: provider.id,
        providerSlug: provider.slug,
        protocol: provider.protocol,
        subject: claims.subject,
        sessionId,
        isNewUser
      },
      version: 1
    });

    const tokens = this.tokenService.issueTokens(user, {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      authMethod: 'OIDC',
      provider: provider.slug,
      federatedSub: claims.subject,
      sessionId,
      refreshTokenJti,
      expiresInSeconds: tenant.config.sessionTtlSeconds,
      isNewUser,
      redirectUrl: authState.clientRedirectUrl
    });

    return Result.ok(tokens);
  }
}

export interface ExchangeOidcIdTokenCommand {
  provider: string;
  idToken: string;
  tenantId?: string;
  tenantSlug?: string;
  nonce?: string;
}

export class ExchangeOidcIdTokenUseCase implements UseCase<ExchangeOidcIdTokenCommand, AuthTokensDto> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly tenantResolver: TenantResolverService,
    providerRepo: IOidcProviderRepository,
    private readonly userRepo: IUserRepository,
    private readonly federatedRepo: IFederatedIdentityRepository,
    private readonly oidcRegistry: IOidcProviderRegistry,
    private readonly tokenService: ITokenService,
    private readonly ssoSessionRepo?: ISsoSessionRepository
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: ExchangeOidcIdTokenCommand): Promise<Result<AuthTokensDto>> {
    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant || !tenant.isActive) {
      return Result.fail('Tenant not found or inactive');
    }
    if (!tenant.config.allowFederatedLogin) {
      return Result.fail('Federated login is disabled for this tenant');
    }

    const { provider, error: providerErr } = await this.providerResolver.resolveForAuth(tenant.id, command.provider);
    if (!provider || !provider.isActiveForAuth()) {
      return Result.fail(providerErr || `OIDC provider '${command.provider}' not found or disabled`);
    }

    const clientSecret = provider.clientSecretEncrypted
      ? CryptoService.decrypt(provider.clientSecretEncrypted)
      : undefined;

    const adapter = this.oidcRegistry.getAdapter(provider.providerType);
    const claims = await adapter.verifyIdTokenAndExtractClaims({
      provider,
      idToken: command.idToken,
      expectedNonce: command.nonce,
      clientSecret
    });

    if (!claims.email) {
      return Result.fail('ID token missing email claim');
    }
    if (!provider.isEmailDomainAllowed(claims.email) || !tenant.isEmailDomainAllowed(claims.email)) {
      return Result.fail('Email domain is not permitted by policy');
    }

    let isNewUser = false;
    let user: User | null = null;
    const existingFed = await this.federatedRepo.findBySubject(tenant.id, provider.id, claims.subject);

    if (existingFed) {
      user = await this.userRepo.findById(existingFed.userId, tenant.id);
      if (!user || !user.isActive) {
        return Result.fail('Linked user account not found or disabled');
      }
      existingFed.recordLogin(claims.email, claims.rawClaims);
      await this.federatedRepo.update(existingFed);
      user.updateProfileFromFederation(claims.name);
      await this.userRepo.update(user);
    } else {
      user = await this.userRepo.findByEmail(claims.email, tenant.id);
      if (user) {
        if (!user.isActive) {
          return Result.fail('User account has been disabled');
        }
        if (!claims.emailVerified) {
          return Result.fail('Cannot link unverified email to existing user account');
        }
        user.markFederatedLinked();
        await this.userRepo.update(user);
      } else {
        if (!provider.autoProvision || !tenant.config.autoProvisionUsers) {
          return Result.fail('Auto-provisioning is disabled for this tenant/provider');
        }
        const role = provider.resolveRole(claims.externalRoles, tenant.config.defaultRole || 'USER');
        user = User.create({
          tenantId: tenant.id,
          email: claims.email,
          name: claims.name || claims.email.split('@')[0],
          role,
          authMethod: 'OIDC'
        });
        await this.userRepo.save(user);
        isNewUser = true;

        await rabbitmq.publish('iam.user_registered', {
          id: crypto.randomUUID(),
          eventName: 'iam.user_registered',
          aggregateId: user.id,
          occurredAt: new Date().toISOString(),
          tenantId: tenant.id,
          payload: {
            userId: user.id,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            email: user.email,
            name: user.name,
            role: user.role,
            authMethod: 'OIDC',
            provider: provider.slug,
            protocol: provider.protocol
          },
          version: 1
        });
      }

      const fed = FederatedIdentity.create({
        tenantId: tenant.id,
        userId: user.id,
        providerId: provider.id,
        providerSlug: provider.slug,
        subject: claims.subject,
        email: claims.email,
        profile: claims.rawClaims
      });
      await this.federatedRepo.save(fed);
    }

    let sessionId: string | undefined;
    let refreshTokenJti: string | undefined;
    if (this.ssoSessionRepo) {
      const session = SsoSession.create({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        authMethod: user.authMethod === 'LOCAL' ? 'OIDC' : user.authMethod,
        providerId: provider.id,
        providerSlug: provider.slug,
        federatedSub: claims.subject,
        idTokenHintEncrypted: CryptoService.encrypt(command.idToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await this.ssoSessionRepo.save(session);
      sessionId = session.id;
      refreshTokenJti = session.refreshTokenJti;
    }

    await rabbitmq.publish('iam.federated_login_succeeded', {
      id: crypto.randomUUID(),
      eventName: 'iam.federated_login_succeeded',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        userId: user.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        email: user.email,
        providerId: provider.id,
        providerSlug: provider.slug,
        protocol: provider.protocol,
        subject: claims.subject,
        sessionId,
        isNewUser
      },
      version: 1
    });

    const tokens = this.tokenService.issueTokens(user, {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      authMethod: 'OIDC',
      provider: provider.slug,
      federatedSub: claims.subject,
      sessionId,
      refreshTokenJti,
      expiresInSeconds: tenant.config.sessionTtlSeconds,
      isNewUser
    });

    return Result.ok(tokens);
  }
}

export class ListMyFederatedIdentitiesQuery implements UseCase<
  { userId: string; tenantId: string },
  FederatedIdentityDto[]
> {
  constructor(private readonly federatedRepo: IFederatedIdentityRepository) {}

  async execute(query: { userId: string; tenantId: string }): Promise<Result<FederatedIdentityDto[]>> {
    const items = await this.federatedRepo.findByUserId(query.userId, query.tenantId);
    return Result.ok(
      items.map((item) => ({
        id: item.id,
        tenantId: item.tenantId,
        userId: item.userId,
        providerId: item.providerId,
        providerSlug: item.providerSlug,
        subject: item.subject,
        email: item.email,
        lastLoginAt: item.lastLoginAt?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString()
      }))
    );
  }
}

export class UnlinkFederatedIdentityUseCase implements UseCase<
  { id: string; userId: string; tenantId: string },
  { unlinked: boolean }
> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly federatedRepo: IFederatedIdentityRepository
  ) {}

  async execute(command: { id: string; userId: string; tenantId: string }): Promise<Result<{ unlinked: boolean }>> {
    const user = await this.userRepo.findById(command.userId, command.tenantId);
    if (!user) {
      return Result.fail('User not found');
    }

    const linked = await this.federatedRepo.findByUserId(command.userId, command.tenantId);
    if (!linked.some((l) => l.id === command.id)) {
      return Result.fail('Federated identity not found');
    }

    if (!user.canAuthenticateLocally() && linked.length <= 1) {
      return Result.fail('Cannot unlink the only authentication method; set a local password or link another provider first');
    }

    const unlinked = await this.federatedRepo.deleteById(command.id, command.userId, command.tenantId);
    return Result.ok({ unlinked });
  }
}
