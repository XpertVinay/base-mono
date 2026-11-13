import crypto from 'crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import {
  OidcProvider,
  SamlProviderConfig,
  inferFederationProtocol
} from '../../domain/entities/oidc-provider.entity.js';
import { CryptoService } from '../../shared/infrastructure/crypto.service.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import {
  FederationProtocol,
  OidcProviderDto,
  OidcProviderPublicDto,
  OidcProviderType
} from '../../shared/contracts/index.js';
import { TenantResolverService } from '../services/tenant-resolver.service.js';
import { ProviderResolverService } from '../services/provider-resolver.service.js';
import { IOidcProviderRegistry, OidcDiscoveryMetadata } from '../ports/oidc-provider-adapter.port.js';
import { getMultiTenancyConfig } from '../../shared/presentation/tenant.middleware.js';

export function toOidcProviderDto(provider: OidcProvider): OidcProviderDto {
  return {
    id: provider.id,
    tenantId: provider.tenantId,
    slug: provider.slug,
    providerType: provider.providerType,
    protocol: provider.protocol,
    displayName: provider.displayName,
    issuerUrl: provider.issuerUrl,
    authorizationEndpoint: provider.authorizationEndpoint,
    tokenEndpoint: provider.tokenEndpoint,
    userinfoEndpoint: provider.userinfoEndpoint,
    jwksUri: provider.jwksUri,
    endSessionEndpoint: provider.endSessionEndpoint,
    clientId: provider.clientId,
    hasClientSecret: Boolean(provider.clientSecretEncrypted),
    redirectUri: provider.redirectUri,
    allowedRedirectUris: provider.allowedRedirectUris,
    scopes: provider.scopes,
    usePkce: provider.usePkce,
    autoProvision: provider.autoProvision,
    allowedDomains: provider.allowedDomains,
    claimMapping: provider.claimMapping,
    roleMapping: provider.roleMapping,
    extraAuthParams: provider.extraAuthParams,
    samlConfig: provider.samlConfig
      ? {
          idpEntityId: provider.samlConfig.idpEntityId,
          idpSsoUrl: provider.samlConfig.idpSsoUrl,
          idpSloUrl: provider.samlConfig.idpSloUrl,
          spEntityId: provider.samlConfig.spEntityId,
          nameIdFormat: provider.samlConfig.nameIdFormat,
          signAuthnRequest: provider.samlConfig.signAuthnRequest,
          hasIdpCertificate: Boolean(provider.samlConfig.idpCertificatePem)
        }
      : undefined,
    isSystemDefault: provider.isSystemDefault,
    inheritsSystemConfig: provider.inheritsSystemConfig,
    parentProviderId: provider.parentProviderId,
    configSource: provider.getConfigSource(),
    approvalStatus: provider.approvalStatus,
    approvedBy: provider.approvedBy,
    approvedAt: provider.approvedAt?.toISOString(),
    rejectionReason: provider.rejectionReason,
    isEnabled: provider.isEnabled,
    createdAt: provider.createdAt.toISOString(),
    updatedAt: provider.updatedAt.toISOString()
  };
}

export interface ConfigureOidcProviderCommand {
  tenantId?: string;
  tenantSlug?: string;
  slug: string;
  providerType: OidcProviderType;
  protocol?: FederationProtocol;
  displayName: string;
  issuerUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  allowedRedirectUris?: string[];
  scopes?: string;
  usePkce?: boolean;
  autoProvision?: boolean;
  allowedDomains?: string[];
  claimMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  extraAuthParams?: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  isSystemDefault?: boolean;
  inheritsSystemConfig?: boolean;
  parentProviderId?: string;
  isEnabled?: boolean;
  actorUserId?: string;
  actorTenantId?: string;
}

export class ConfigureOidcProviderUseCase implements UseCase<ConfigureOidcProviderCommand, OidcProviderDto> {
  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: ConfigureOidcProviderCommand): Promise<Result<OidcProviderDto>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !command.actorTenantId || command.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }

    if (!isPlatformAdmin && tenant.id !== command.actorTenantId) {
      return Result.fail('Cannot configure federation providers for a different tenant');
    }

    if (command.isSystemDefault && (!isPlatformAdmin || tenant.id !== defaultTenantId)) {
      return Result.fail('Only platform administrators can configure system-default providers on the default tenant');
    }

    const slug = command.slug.trim().toLowerCase();
    const existing = await this.providerRepo.findBySlug(tenant.id, slug);
    if (existing) {
      return Result.fail(`OIDC provider '${slug}' already exists for tenant '${tenant.slug}'`);
    }

    const clientSecretEncrypted = command.clientSecret
      ? CryptoService.encrypt(command.clientSecret)
      : undefined;

    const hasCustomCredentials = Boolean(command.clientSecret || command.samlConfig?.idpCertificatePem || command.clientId);
    const approvalStatus = isPlatformAdmin
      ? 'APPROVED'
      : command.inheritsSystemConfig && !hasCustomCredentials
        ? 'APPROVED'
        : 'PENDING';

    const provider = OidcProvider.create({
      tenantId: tenant.id,
      slug,
      providerType: command.providerType,
      protocol: command.protocol || inferFederationProtocol(command.providerType),
      displayName: command.displayName,
      issuerUrl: command.issuerUrl,
      authorizationEndpoint: command.authorizationEndpoint,
      tokenEndpoint: command.tokenEndpoint,
      userinfoEndpoint: command.userinfoEndpoint,
      jwksUri: command.jwksUri,
      endSessionEndpoint: command.endSessionEndpoint,
      clientId: command.clientId,
      clientSecretEncrypted,
      redirectUri: command.redirectUri,
      allowedRedirectUris: command.allowedRedirectUris,
      scopes: command.scopes,
      usePkce: command.usePkce,
      autoProvision: command.autoProvision,
      allowedDomains: command.allowedDomains,
      claimMapping: command.claimMapping,
      roleMapping: command.roleMapping,
      extraAuthParams: command.extraAuthParams,
      samlConfig: command.samlConfig,
      isSystemDefault: Boolean(command.isSystemDefault),
      inheritsSystemConfig: Boolean(command.inheritsSystemConfig),
      parentProviderId: command.parentProviderId,
      approvalStatus,
      isEnabled: command.isEnabled
    });

    if (approvalStatus === 'APPROVED' && command.actorUserId) {
      provider.approve(command.actorUserId);
    }

    await this.providerRepo.save(provider);

    await rabbitmq.publish('iam.federation_provider_configured', {
      id: crypto.randomUUID(),
      eventName: 'iam.federation_provider_configured',
      aggregateId: provider.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        providerId: provider.id,
        slug: provider.slug,
        providerType: provider.providerType,
        protocol: provider.protocol,
        isSystemDefault: provider.isSystemDefault,
        approvalStatus: provider.approvalStatus
      },
      version: 1
    });

    return Result.ok(toOidcProviderDto(provider));
  }
}

export interface AssociateSystemProviderCommand {
  tenantId?: string;
  tenantSlug?: string;
  systemProvider: string;
  slug?: string;
  displayName?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedRedirectUris?: string[];
  issuerUrl?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  scopes?: string;
  autoProvision?: boolean;
  allowedDomains?: string[];
  claimMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  extraAuthParams?: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  inheritsSystemConfig?: boolean;
  isEnabled?: boolean;
  actorUserId?: string;
  actorTenantId?: string;
}

export class AssociateSystemProviderUseCase implements UseCase<AssociateSystemProviderCommand, OidcProviderDto> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: AssociateSystemProviderCommand): Promise<Result<OidcProviderDto>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !command.actorTenantId || command.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    if (!isPlatformAdmin && tenant.id !== command.actorTenantId) {
      return Result.fail('Cannot associate providers for a different tenant');
    }
    if (tenant.id === defaultTenantId) {
      return Result.fail('Cannot create a tenant override on the default system tenant');
    }

    const sys = await this.providerResolver.findSystemDefault(command.systemProvider);
    if (!sys || !sys.isActiveForAuth()) {
      return Result.fail(`System-default provider '${command.systemProvider}' not found or disabled`);
    }

    const targetSlug = (command.slug || sys.slug).trim().toLowerCase();
    const existing = await this.providerRepo.findBySlug(tenant.id, targetSlug);
    if (existing) {
      return Result.fail(`Provider '${targetSlug}' is already configured for tenant '${tenant.slug}'`);
    }

    const hasCredentialOrEndpointOverride = Boolean(
      command.clientId ||
        command.clientSecret ||
        command.issuerUrl ||
        command.authorizationEndpoint ||
        command.tokenEndpoint ||
        command.jwksUri ||
        command.samlConfig
    );

    const approvalStatus = isPlatformAdmin || !hasCredentialOrEndpointOverride ? 'APPROVED' : 'PENDING';

    const provider = OidcProvider.create({
      tenantId: tenant.id,
      slug: targetSlug,
      providerType: sys.providerType,
      protocol: sys.protocol,
      displayName: command.displayName || sys.displayName,
      issuerUrl: command.issuerUrl || sys.issuerUrl,
      authorizationEndpoint: command.authorizationEndpoint ?? sys.authorizationEndpoint,
      tokenEndpoint: command.tokenEndpoint ?? sys.tokenEndpoint,
      userinfoEndpoint: command.userinfoEndpoint ?? sys.userinfoEndpoint,
      jwksUri: command.jwksUri ?? sys.jwksUri,
      endSessionEndpoint: command.endSessionEndpoint ?? sys.endSessionEndpoint,
      clientId: command.clientId || sys.clientId,
      clientSecretEncrypted: command.clientSecret
        ? CryptoService.encrypt(command.clientSecret)
        : sys.clientSecretEncrypted,
      redirectUri: command.redirectUri || sys.redirectUri,
      allowedRedirectUris: command.allowedRedirectUris || sys.allowedRedirectUris,
      scopes: command.scopes || sys.scopes,
      usePkce: sys.usePkce,
      autoProvision: command.autoProvision ?? sys.autoProvision,
      allowedDomains: command.allowedDomains || sys.allowedDomains,
      claimMapping: command.claimMapping ? { ...sys.claimMapping, ...command.claimMapping } : sys.claimMapping,
      roleMapping: command.roleMapping ? { ...sys.roleMapping, ...command.roleMapping } : sys.roleMapping,
      extraAuthParams: command.extraAuthParams
        ? { ...sys.extraAuthParams, ...command.extraAuthParams }
        : sys.extraAuthParams,
      samlConfig: command.samlConfig ? { ...(sys.samlConfig || {}), ...command.samlConfig } : sys.samlConfig,
      isSystemDefault: false,
      inheritsSystemConfig: command.inheritsSystemConfig ?? true,
      parentProviderId: sys.id,
      approvalStatus,
      isEnabled: command.isEnabled ?? true
    });

    if (approvalStatus === 'APPROVED' && command.actorUserId) {
      provider.approve(command.actorUserId);
    }

    await this.providerRepo.save(provider);
    return Result.ok(toOidcProviderDto(provider));
  }
}

export interface UpdateOidcProviderCommand {
  id: string;
  tenantId?: string;
  tenantSlug?: string;
  displayName?: string;
  issuerUrl?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  allowedRedirectUris?: string[];
  scopes?: string;
  usePkce?: boolean;
  autoProvision?: boolean;
  allowedDomains?: string[];
  claimMapping?: Record<string, string>;
  roleMapping?: Record<string, string>;
  extraAuthParams?: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  isSystemDefault?: boolean;
  inheritsSystemConfig?: boolean;
  isEnabled?: boolean;
  actorUserId?: string;
  actorTenantId?: string;
}

export class UpdateOidcProviderUseCase implements UseCase<UpdateOidcProviderCommand, OidcProviderDto> {
  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: UpdateOidcProviderCommand): Promise<Result<OidcProviderDto>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !command.actorTenantId || command.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    if (!isPlatformAdmin && tenant.id !== command.actorTenantId) {
      return Result.fail('Cannot modify federation providers for a different tenant');
    }

    const provider = await this.providerRepo.findByIdOrSlug(tenant.id, command.id);
    if (!provider) {
      return Result.fail('OIDC provider not found for this tenant');
    }

    const {
      id: _id,
      tenantId: _tId,
      tenantSlug: _tSlug,
      actorUserId: _actorId,
      actorTenantId: _actorTenant,
      clientSecret,
      ...rest
    } = command;

    const sensitiveModified = Boolean(
      clientSecret !== undefined ||
        rest.clientId !== undefined ||
        rest.issuerUrl !== undefined ||
        rest.authorizationEndpoint !== undefined ||
        rest.tokenEndpoint !== undefined ||
        rest.jwksUri !== undefined ||
        rest.samlConfig !== undefined
    );

    provider.update({
      ...rest,
      ...(clientSecret !== undefined
        ? { clientSecretEncrypted: clientSecret ? CryptoService.encrypt(clientSecret) : undefined }
        : {})
    });

    if (!isPlatformAdmin && sensitiveModified) {
      provider.markPendingApproval();
    }

    await this.providerRepo.update(provider);
    return Result.ok(toOidcProviderDto(provider));
  }
}

export class ApproveOidcProviderUseCase implements UseCase<
  { id: string; tenantId?: string; tenantSlug?: string; approvedBy: string; actorTenantId?: string },
  OidcProviderDto
> {
  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    approvedBy: string;
    actorTenantId?: string;
  }): Promise<Result<OidcProviderDto>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    if (command.actorTenantId && command.actorTenantId !== defaultTenantId) {
      return Result.fail('Only platform administrators can approve tenant federation overrides');
    }

    let provider: OidcProvider | null = await this.providerRepo.findById(command.id);
    if (!provider && (command.tenantId || command.tenantSlug)) {
      const tenant = await this.tenantResolver.resolve({
        tenantId: command.tenantId,
        tenantSlug: command.tenantSlug
      });
      if (tenant) {
        provider = await this.providerRepo.findByIdOrSlug(tenant.id, command.id);
      }
    }

    if (!provider) {
      return Result.fail('Federation provider not found');
    }

    provider.approve(command.approvedBy);
    await this.providerRepo.update(provider);

    await rabbitmq.publish('iam.federation_provider_approved', {
      id: crypto.randomUUID(),
      eventName: 'iam.federation_provider_approved',
      aggregateId: provider.id,
      occurredAt: new Date().toISOString(),
      tenantId: provider.tenantId,
      payload: {
        providerId: provider.id,
        slug: provider.slug,
        tenantId: provider.tenantId,
        approvedBy: command.approvedBy
      },
      version: 1
    });

    return Result.ok(toOidcProviderDto(provider));
  }
}

export class RejectOidcProviderUseCase implements UseCase<
  { id: string; tenantId?: string; tenantSlug?: string; rejectedBy: string; reason?: string; actorTenantId?: string },
  OidcProviderDto
> {
  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    rejectedBy: string;
    reason?: string;
    actorTenantId?: string;
  }): Promise<Result<OidcProviderDto>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    if (command.actorTenantId && command.actorTenantId !== defaultTenantId) {
      return Result.fail('Only platform administrators can reject tenant federation overrides');
    }

    let provider: OidcProvider | null = await this.providerRepo.findById(command.id);
    if (!provider && (command.tenantId || command.tenantSlug)) {
      const tenant = await this.tenantResolver.resolve({
        tenantId: command.tenantId,
        tenantSlug: command.tenantSlug
      });
      if (tenant) {
        provider = await this.providerRepo.findByIdOrSlug(tenant.id, command.id);
      }
    }

    if (!provider) {
      return Result.fail('Federation provider not found');
    }

    provider.reject(command.rejectedBy, command.reason);
    await this.providerRepo.update(provider);

    await rabbitmq.publish('iam.federation_provider_rejected', {
      id: crypto.randomUUID(),
      eventName: 'iam.federation_provider_rejected',
      aggregateId: provider.id,
      occurredAt: new Date().toISOString(),
      tenantId: provider.tenantId,
      payload: {
        providerId: provider.id,
        slug: provider.slug,
        tenantId: provider.tenantId,
        rejectedBy: command.rejectedBy,
        reason: provider.rejectionReason
      },
      version: 1
    });

    return Result.ok(toOidcProviderDto(provider));
  }
}

export class DeleteOidcProviderUseCase implements UseCase<
  { id: string; tenantId?: string; tenantSlug?: string; actorTenantId?: string },
  { deleted: boolean }
> {
  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {}

  async execute(command: {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    actorTenantId?: string;
  }): Promise<Result<{ deleted: boolean }>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !command.actorTenantId || command.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    if (!isPlatformAdmin && tenant.id !== command.actorTenantId) {
      return Result.fail('Cannot delete federation providers for a different tenant');
    }

    const provider = await this.providerRepo.findByIdOrSlug(tenant.id, command.id);
    if (!provider) {
      return Result.fail('OIDC provider not found');
    }

    const deleted = await this.providerRepo.delete(provider.id, tenant.id);
    return Result.ok({ deleted });
  }
}

export class ListOidcProvidersAdminQuery implements UseCase<
  { tenantId?: string; tenantSlug?: string; actorTenantId?: string; includeSystemDefaults?: boolean },
  OidcProviderDto[]
> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(query: {
    tenantId?: string;
    tenantSlug?: string;
    actorTenantId?: string;
    includeSystemDefaults?: boolean;
  }): Promise<Result<OidcProviderDto[]>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !query.actorTenantId || query.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: query.tenantId,
      tenantSlug: query.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    if (!isPlatformAdmin && tenant.id !== query.actorTenantId) {
      return Result.fail('Cannot inspect federation providers for a different tenant');
    }

    const providers = await this.providerRepo.listByTenant(tenant.id, false);
    if (query.includeSystemDefaults && tenant.id !== defaultTenantId) {
      const defaults = await this.providerResolver.listSystemDefaults(true);
      const ownedSlugs = new Set(providers.map((p) => p.slug));
      for (const sys of defaults) {
        if (!ownedSlugs.has(sys.slug)) {
          providers.push(sys.asInheritedForTenant(tenant.id));
        }
      }
    }
    return Result.ok(providers.map(toOidcProviderDto));
  }
}

export class ListPendingOidcProvidersQuery implements UseCase<{ actorTenantId?: string }, OidcProviderDto[]> {
  constructor(private readonly providerRepo: IOidcProviderRepository) {}

  async execute(query: { actorTenantId?: string }): Promise<Result<OidcProviderDto[]>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    if (query.actorTenantId && query.actorTenantId !== defaultTenantId) {
      return Result.fail('Only platform administrators can list pending provider approvals');
    }

    if (this.providerRepo.listPendingApprovals) {
      const pending = await this.providerRepo.listPendingApprovals();
      return Result.ok(pending.map(toOidcProviderDto));
    }

    return Result.ok([]);
  }
}

export class ListTenantOidcProvidersQuery implements UseCase<{ tenantId?: string; tenantSlug?: string }, OidcProviderPublicDto[]> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(query: { tenantId?: string; tenantSlug?: string }): Promise<Result<OidcProviderPublicDto[]>> {
    const tenant = await this.tenantResolver.resolve({
      tenantId: query.tenantId,
      tenantSlug: query.tenantSlug
    });
    if (!tenant || !tenant.isActive || !tenant.config.allowFederatedLogin) {
      return Result.ok([]);
    }

    const providers = await this.providerResolver.listEffectiveForTenant(tenant.id);
    return Result.ok(
      providers.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        slug: p.slug,
        providerType: p.providerType,
        protocol: p.protocol,
        displayName: p.displayName,
        scopes: p.scopes,
        usePkce: p.usePkce,
        authorizeUrl: `/api/v1/iam/oidc/${encodeURIComponent(p.slug)}/authorize?tenantId=${encodeURIComponent(tenant.id)}`,
        configSource: p.getConfigSource(),
        isSystemDefault: p.isSystemDefault,
        inheritsSystemConfig: p.inheritsSystemConfig
      }))
    );
  }
}

export class TestOidcProviderDiscoveryUseCase implements UseCase<
  { id: string; tenantId?: string; tenantSlug?: string; actorTenantId?: string },
  OidcDiscoveryMetadata
> {
  private readonly providerResolver: ProviderResolverService;

  constructor(
    private readonly providerRepo: IOidcProviderRepository,
    private readonly tenantResolver: TenantResolverService,
    private readonly oidcRegistry: IOidcProviderRegistry
  ) {
    this.providerResolver = new ProviderResolverService(providerRepo);
  }

  async execute(command: {
    id: string;
    tenantId?: string;
    tenantSlug?: string;
    actorTenantId?: string;
  }): Promise<Result<OidcDiscoveryMetadata>> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const isPlatformAdmin = !command.actorTenantId || command.actorTenantId === defaultTenantId;

    const tenant = await this.tenantResolver.resolve({
      tenantId: command.tenantId,
      tenantSlug: command.tenantSlug
    });
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    if (!isPlatformAdmin && tenant.id !== command.actorTenantId) {
      return Result.fail('Cannot test discovery for a different tenant');
    }

    let provider = await this.providerRepo.findByIdOrSlug(tenant.id, command.id);
    if (!provider) {
      provider = await this.providerResolver.findSystemDefault(command.id);
    }
    if (!provider) {
      return Result.fail('OIDC provider not found');
    }

    try {
      const adapter = this.oidcRegistry.getAdapter(provider.providerType);
      const metadata = await adapter.discover(provider.issuerUrl);
      return Result.ok(metadata);
    } catch (err: any) {
      return Result.fail(`OIDC discovery failed: ${err.message}`);
    }
  }
}
