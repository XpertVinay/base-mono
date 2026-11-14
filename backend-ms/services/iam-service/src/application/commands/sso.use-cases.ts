import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import { ISsoSessionRepository } from '../../domain/repositories/sso-session-repository.interface.js';
import { ISsoHandoffRepository } from '../../domain/repositories/sso-handoff-repository.interface.js';
import { ITokenService } from '../ports/token-service.port.js';
import { IOidcProviderRegistry } from '../ports/oidc-provider-adapter.port.js';
import { ProviderResolverService } from '../services/provider-resolver.service.js';
import { CryptoService } from '../../shared/infrastructure/crypto.service.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { verifyOidcLogoutToken } from '../../infrastructure/oidc/oidc-crypto.util.js';
import {
  ServiceProviderTokenDto,
  SloResultDto,
  SsoHandoffCodeDto,
  SsoSessionDto
} from '../../shared/contracts/index.js';

export interface CreateSsoHandoffCommand {
  sessionId: string;
  userId: string;
  tenantId: string;
  targetService: string;
  scope?: string;
  codeChallenge?: string;
  redirectUri?: string;
}

export class CreateSsoHandoffCodeUseCase implements UseCase<CreateSsoHandoffCommand, SsoHandoffCodeDto> {
  constructor(
    private readonly ssoSessionRepo: ISsoSessionRepository,
    private readonly ssoHandoffRepo: ISsoHandoffRepository
  ) {}

  async execute(command: CreateSsoHandoffCommand): Promise<Result<SsoHandoffCodeDto>> {
    const session = await this.ssoSessionRepo.findById(command.sessionId);
    if (!session || !session.isActive()) {
      return Result.fail('Active SSO session not found or has been revoked');
    }
    if (session.userId !== command.userId || session.tenantId !== command.tenantId) {
      return Result.fail('SSO session does not match authenticated user/tenant context');
    }

    const code = `sso_${crypto.randomBytes(24).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60s single-use code

    await this.ssoHandoffRepo.save({
      code,
      sessionId: session.id,
      tenantId: session.tenantId,
      userId: session.userId,
      targetService: command.targetService.trim(),
      scope: command.scope,
      codeChallenge: command.codeChallenge,
      redirectUri: command.redirectUri,
      expiresAt,
      createdAt: new Date()
    });

    let redirectUrl: string | undefined;
    if (command.redirectUri) {
      const url = new URL(command.redirectUri);
      url.searchParams.set('sso_code', code);
      redirectUrl = url.toString();
    }

    return Result.ok({
      code,
      targetService: command.targetService.trim(),
      expiresAt: expiresAt.toISOString(),
      ...(redirectUrl ? { redirectUrl } : {})
    });
  }
}

export interface RedeemSsoHandoffCommand {
  code: string;
  targetService: string;
  codeVerifier?: string;
  expectedTenantId?: string;
}

export class RedeemSsoHandoffCodeUseCase implements UseCase<RedeemSsoHandoffCommand, ServiceProviderTokenDto> {
  constructor(
    private readonly ssoHandoffRepo: ISsoHandoffRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository,
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(command: RedeemSsoHandoffCommand): Promise<Result<ServiceProviderTokenDto>> {
    const handoff = await this.ssoHandoffRepo.consume(command.code);
    if (!handoff) {
      return Result.fail('Invalid or already consumed SSO handoff code');
    }
    if (handoff.expiresAt.getTime() < Date.now()) {
      return Result.fail('SSO handoff code has expired');
    }
    if (handoff.targetService !== command.targetService.trim()) {
      return Result.fail('SSO handoff code targetService audience mismatch');
    }
    if (command.expectedTenantId && handoff.tenantId !== command.expectedTenantId) {
      return Result.fail('SSO handoff code tenant mismatch');
    }

    if (handoff.codeChallenge) {
      if (!command.codeVerifier) {
        return Result.fail('PKCE codeVerifier is required to redeem this SSO handoff code');
      }
      const computed = crypto.createHash('sha256').update(command.codeVerifier).digest('base64url');
      if (computed !== handoff.codeChallenge) {
        return Result.fail('PKCE codeVerifier verification failed for SSO handoff');
      }
    }

    const session = await this.ssoSessionRepo.findById(handoff.sessionId);
    if (!session || !session.isActive()) {
      return Result.fail('Underlying SSO session has expired or been logged out');
    }

    const user = await this.userRepo.findById(handoff.userId, handoff.tenantId);
    if (!user || !user.isActive) {
      return Result.fail('User account not found or disabled');
    }

    const tenant = await this.tenantRepo.findById(handoff.tenantId);
    if (tenant && !tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }

    if (!this.tokenService.issueServiceToken) {
      return Result.fail('Token service does not support audience-scoped service tokens');
    }

    const spToken = this.tokenService.issueServiceToken(user, {
      tenantId: handoff.tenantId,
      tenantSlug: tenant?.slug || session.tenantSlug,
      authMethod: session.authMethod,
      provider: session.providerSlug,
      sessionId: session.id,
      audience: handoff.targetService,
      scope: handoff.scope,
      expiresInSeconds: 300
    });

    return Result.ok(spToken);
  }
}

export interface ExchangeServiceTokenCommand {
  sessionId: string;
  userId: string;
  tenantId: string;
  targetService: string;
  scope?: string;
  expiresInSeconds?: number;
}

export class ExchangeServiceTokenUseCase implements UseCase<ExchangeServiceTokenCommand, ServiceProviderTokenDto> {
  constructor(
    private readonly ssoSessionRepo: ISsoSessionRepository,
    private readonly userRepo: IUserRepository,
    private readonly tenantRepo: ITenantRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(command: ExchangeServiceTokenCommand): Promise<Result<ServiceProviderTokenDto>> {
    const session = await this.ssoSessionRepo.findById(command.sessionId);
    if (!session || !session.isActive()) {
      return Result.fail('SSO session is inactive or has been revoked');
    }
    if (session.userId !== command.userId || session.tenantId !== command.tenantId) {
      return Result.fail('SSO session tenant/user mismatch');
    }

    const user = await this.userRepo.findById(command.userId, command.tenantId);
    if (!user || !user.isActive) {
      return Result.fail('User account not found or inactive');
    }

    const tenant = await this.tenantRepo.findById(command.tenantId);
    if (tenant && !tenant.isActive) {
      return Result.fail('Tenant account is inactive');
    }

    if (!this.tokenService.issueServiceToken) {
      return Result.fail('Service token issuance not supported');
    }

    const ttl = Math.min(command.expiresInSeconds || 300, tenant?.config.sessionTtlSeconds || 3600);
    const spToken = this.tokenService.issueServiceToken(user, {
      tenantId: command.tenantId,
      tenantSlug: tenant?.slug || session.tenantSlug,
      authMethod: session.authMethod,
      provider: session.providerSlug,
      sessionId: session.id,
      audience: command.targetService.trim(),
      scope: command.scope,
      expiresInSeconds: ttl
    });

    return Result.ok(spToken);
  }
}

export interface IntrospectSsoTokenCommand {
  token: string;
  expectedTenantId?: string;
  expectedAudience?: string;
}

export interface IntrospectedTokenDto {
  active: boolean;
  reason?: string;
  sub?: string;
  email?: string;
  role?: string;
  tenantId?: string;
  tenantSlug?: string;
  audience?: string;
  sessionId?: string;
  authMethod?: string;
  provider?: string;
  scope?: string;
  exp?: number;
}

export class IntrospectSsoTokenUseCase implements UseCase<IntrospectSsoTokenCommand, IntrospectedTokenDto> {
  constructor(private readonly ssoSessionRepo: ISsoSessionRepository) {}

  async execute(command: IntrospectSsoTokenCommand): Promise<Result<IntrospectedTokenDto>> {
    try {
      const complete = jwt.decode(command.token, { complete: true }) as any;
      const alg = complete?.header?.alg;

      let decoded: any;
      if (alg === 'RS256') {
        const pubKey = (process.env.JWT_PUBLIC_KEY || process.env.IAM_JWT_PUBLIC_KEY)?.replace(/\\n/g, '\n');
        if (!pubKey) {
          return Result.ok({ active: false, reason: 'INVALID_OR_EXPIRED_TOKEN' });
        }
        decoded = jwt.verify(command.token, pubKey, { algorithms: ['RS256'] });
      } else {
        const secret = process.env.JWT_SECRET || 'dev-jwt-super-secret-key-for-iam-service-32-chars';
        decoded = jwt.verify(command.token, secret, { algorithms: ['HS256'] });
      }

      const tenantId = decoded.tenantId || decoded.tid || process.env.DEFAULT_TENANT_ID || 'default';
      const aud = decoded.aud ? String(decoded.aud) : undefined;

      if (command.expectedTenantId && tenantId !== command.expectedTenantId) {
        return Result.ok({ active: false, reason: 'TENANT_MISMATCH' });
      }
      if (command.expectedAudience && aud !== command.expectedAudience) {
        return Result.ok({ active: false, reason: 'AUDIENCE_MISMATCH' });
      }

      if (decoded.sid) {
        const revoked = await this.ssoSessionRepo.isRevoked(String(decoded.sid));
        if (revoked) {
          return Result.ok({ active: false, reason: 'SESSION_REVOKED' });
        }
      }

      return Result.ok({
        active: true,
        sub: decoded.sub || decoded.id,
        email: decoded.email,
        role: decoded.role,
        tenantId,
        tenantSlug: decoded.tenantSlug,
        audience: aud,
        sessionId: decoded.sid,
        authMethod: decoded.authMethod,
        provider: decoded.provider,
        scope: decoded.scope,
        exp: decoded.exp
      });
    } catch {
      return Result.ok({ active: false, reason: 'INVALID_OR_EXPIRED_TOKEN' });
    }
  }
}

export class ListMySsoSessionsQuery implements UseCase<{ userId: string; tenantId: string }, SsoSessionDto[]> {
  constructor(private readonly ssoSessionRepo: ISsoSessionRepository) {}

  async execute(query: { userId: string; tenantId: string }): Promise<Result<SsoSessionDto[]>> {
    const sessions = await this.ssoSessionRepo.listActiveByUser(query.userId, query.tenantId);
    return Result.ok(
      sessions.map((s) => ({
        id: s.id,
        tenantId: s.tenantId,
        tenantSlug: s.tenantSlug,
        userId: s.userId,
        authMethod: s.authMethod,
        providerId: s.providerId,
        providerSlug: s.providerSlug,
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt?.toISOString(),
        revokedReason: s.revokedReason,
        lastActivityAt: s.lastActivityAt.toISOString(),
        createdAt: s.createdAt.toISOString()
      }))
    );
  }
}

export interface InitiateSloLogoutCommand {
  sessionId?: string;
  userId: string;
  tenantId: string;
  allSessions?: boolean;
  postLogoutRedirectUri?: string;
  state?: string;
}

export class InitiateSloLogoutUseCase implements UseCase<InitiateSloLogoutCommand, SloResultDto> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly ssoSessionRepo: ISsoSessionRepository,
    providerRepo: IOidcProviderRepository,
    private readonly oidcRegistry: IOidcProviderRegistry
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: InitiateSloLogoutCommand): Promise<Result<SloResultDto>> {
    let revokedSessions = 0;
    let idpLogoutUrl: string | undefined;

    const targetSession = command.sessionId
      ? await this.ssoSessionRepo.findById(command.sessionId)
      : undefined;

    if (command.allSessions) {
      revokedSessions = await this.ssoSessionRepo.revokeByUser(
        command.userId,
        command.tenantId,
        'Global Single Logout (SLO)'
      );
    } else if (command.sessionId) {
      if (targetSession && targetSession.userId === command.userId && targetSession.tenantId === command.tenantId) {
        const revoked = await this.ssoSessionRepo.revokeById(command.sessionId, 'Single Logout (SLO)');
        if (revoked) revokedSessions = 1;
      }
    } else {
      revokedSessions = await this.ssoSessionRepo.revokeByUser(
        command.userId,
        command.tenantId,
        'Single Logout (SLO)'
      );
    }

    // Build upstream IdP RP-Initiated Logout URL if session used a federated provider
    if (targetSession?.providerSlug || targetSession?.providerId) {
      const { provider } = await this.providerResolver.resolveForAuth(
        command.tenantId,
        targetSession.providerSlug || targetSession.providerId!
      );
      if (provider) {
        const adapter = this.oidcRegistry.getAdapter(provider.providerType);
        if (adapter.buildLogoutUrl) {
          const idTokenHint = targetSession.idTokenHintEncrypted
            ? CryptoService.decrypt(targetSession.idTokenHintEncrypted)
            : undefined;
          idpLogoutUrl = await adapter.buildLogoutUrl({
            provider,
            idTokenHint,
            postLogoutRedirectUri: command.postLogoutRedirectUri,
            state: command.state,
            subject: targetSession.federatedSub
          });
        }
      }
    }

    await rabbitmq.publish('iam.sso_session_revoked', {
      id: crypto.randomUUID(),
      eventName: 'iam.sso_session_revoked',
      aggregateId: command.sessionId || command.userId,
      occurredAt: new Date().toISOString(),
      tenantId: command.tenantId,
      payload: {
        userId: command.userId,
        tenantId: command.tenantId,
        sessionId: command.sessionId,
        allSessions: Boolean(command.allSessions),
        revokedSessions
      },
      version: 1
    });

    return Result.ok({
      loggedOut: true,
      sessionId: command.sessionId,
      revokedSessions,
      ...(idpLogoutUrl ? { idpLogoutUrl } : {}),
      backchannelNotified: true
    });
  }
}

export interface BackchannelLogoutCommand {
  provider: string;
  logoutToken: string;
  tenantId?: string;
  tenantSlug?: string;
}

export class HandleBackchannelLogoutUseCase implements UseCase<BackchannelLogoutCommand, { revokedSessions: number }> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    providerRepo: IOidcProviderRepository,
    private readonly ssoSessionRepo: ISsoSessionRepository,
    private readonly oidcRegistry: IOidcProviderRegistry
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: BackchannelLogoutCommand): Promise<Result<{ revokedSessions: number }>> {
    const tenantId = command.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    const { provider, error } = await this.providerResolver.resolveForAuth(tenantId, command.provider);
    if (!provider) {
      return Result.fail(error || `Provider '${command.provider}' not found`);
    }

    const adapter = this.oidcRegistry.getAdapter(provider.providerType);
    let jwksUri = provider.jwksUri;
    let issuer = provider.issuerUrl;
    if (!jwksUri) {
      try {
        const meta = await adapter.discover(provider.issuerUrl);
        jwksUri = meta.jwksUri;
        issuer = meta.issuer || issuer;
      } catch {
        // Ignore discovery failure if HMAC secret is used
      }
    }

    const clientSecret = provider.clientSecretEncrypted
      ? CryptoService.decrypt(provider.clientSecretEncrypted)
      : undefined;

    const claims = await verifyOidcLogoutToken({
      logoutToken: command.logoutToken,
      expectedIssuer: issuer,
      expectedAudience: provider.clientId,
      jwksUri,
      clientSecret
    });

    let revokedSessions = 0;
    if (claims.sid) {
      const ok = await this.ssoSessionRepo.revokeById(claims.sid, 'IdP back-channel logout');
      if (ok) revokedSessions += 1;
    }
    if (claims.sub) {
      revokedSessions += await this.ssoSessionRepo.revokeByFederatedSubject(
        tenantId,
        provider.id,
        claims.sub,
        'IdP back-channel logout'
      );
    }

    await rabbitmq.publish('iam.sso_session_revoked', {
      id: crypto.randomUUID(),
      eventName: 'iam.sso_session_revoked',
      aggregateId: claims.sid || claims.sub || provider.id,
      occurredAt: new Date().toISOString(),
      tenantId,
      payload: {
        providerId: provider.id,
        providerSlug: provider.slug,
        sub: claims.sub,
        sid: claims.sid,
        revokedSessions,
        source: 'backchannel_logout'
      },
      version: 1
    });

    return Result.ok({ revokedSessions });
  }
}
