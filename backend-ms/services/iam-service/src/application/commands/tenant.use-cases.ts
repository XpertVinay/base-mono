import crypto from 'crypto';
import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { IUserRepository } from '../../domain/repositories/user-repository.interface.js';
import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import { Tenant, TenantConfig } from '../../domain/entities/tenant.entity.js';
import { User } from '../../domain/entities/user.entity.js';
import { PasswordVO } from '../../domain/value-objects/password.vo.js';
import { rabbitmq } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { TenantDto, UserDto, OidcProviderPublicDto } from '../../shared/contracts/index.js';
import { ProviderResolverService } from '../services/provider-resolver.service.js';

function toTenantDto(tenant: Tenant): TenantDto {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    isActive: tenant.isActive,
    config: tenant.config,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString()
  };
}

export interface CreateTenantCommand {
  id?: string;
  slug: string;
  name: string;
  isActive?: boolean;
  config?: Partial<TenantConfig>;
}

export class CreateTenantUseCase implements UseCase<CreateTenantCommand, TenantDto> {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute(command: CreateTenantCommand): Promise<Result<TenantDto>> {
    const slug = command.slug.trim().toLowerCase();
    const existingBySlug = await this.tenantRepo.findBySlug(slug);
    if (existingBySlug) {
      return Result.fail(`Tenant with slug '${slug}' already exists`);
    }

    if (command.id) {
      const existingById = await this.tenantRepo.findById(command.id);
      if (existingById) {
        return Result.fail(`Tenant with id '${command.id}' already exists`);
      }
    }

    const tenant = Tenant.create(
      {
        slug,
        name: command.name,
        isActive: command.isActive,
        config: command.config
      },
      command.id || slug
    );

    await this.tenantRepo.save(tenant);
    return Result.ok(toTenantDto(tenant));
  }
}

export interface OnboardTenantCommand {
  id?: string;
  slug: string;
  name: string;
  config?: Partial<TenantConfig>;
  adminUser?: {
    email: string;
    password: string;
    name: string;
  };
}

export interface OnboardTenantResult {
  tenant: TenantDto;
  adminUser?: UserDto;
  inheritedProviders: OidcProviderPublicDto[];
}

export class OnboardTenantUseCase implements UseCase<OnboardTenantCommand, OnboardTenantResult> {
  private readonly providerResolver?: ProviderResolverService;

  constructor(
    private readonly tenantRepo: ITenantRepository,
    private readonly userRepo?: IUserRepository,
    providerRepo?: IOidcProviderRepository
  ) {
    if (providerRepo) {
      this.providerResolver = new ProviderResolverService(providerRepo);
    }
  }

  async execute(command: OnboardTenantCommand): Promise<Result<OnboardTenantResult>> {
    const slug = command.slug.trim().toLowerCase();
    const existingBySlug = await this.tenantRepo.findBySlug(slug);
    if (existingBySlug) {
      return Result.fail(`Tenant with slug '${slug}' already exists`);
    }
    if (command.id) {
      const existingById = await this.tenantRepo.findById(command.id);
      if (existingById) {
        return Result.fail(`Tenant with id '${command.id}' already exists`);
      }
    }

    const tenant = Tenant.create(
      {
        slug,
        name: command.name,
        isActive: true,
        config: command.config
      },
      command.id || slug
    );
    await this.tenantRepo.save(tenant);

    let adminUserDto: UserDto | undefined;
    if (command.adminUser && this.userRepo) {
      const passwordHash = await PasswordVO.create(command.adminUser.password);
      const admin = User.create({
        tenantId: tenant.id,
        email: command.adminUser.email,
        passwordHash,
        name: command.adminUser.name,
        role: 'ADMIN',
        authMethod: 'LOCAL'
      });
      await this.userRepo.save(admin);
      adminUserDto = {
        id: admin.id,
        tenantId: admin.tenantId,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        authMethod: admin.authMethod,
        isActive: admin.isActive,
        createdAt: admin.createdAt.toISOString(),
        updatedAt: admin.updatedAt.toISOString()
      };
    }

    const effectiveProviders = this.providerResolver
      ? await this.providerResolver.listEffectiveForTenant(tenant.id)
      : [];

    await rabbitmq.publish('iam.tenant_onboarded', {
      id: crypto.randomUUID(),
      eventName: 'iam.tenant_onboarded',
      aggregateId: tenant.id,
      occurredAt: new Date().toISOString(),
      tenantId: tenant.id,
      payload: {
        tenantId: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        inheritedProviders: effectiveProviders.map((p) => p.slug)
      },
      version: 1
    });

    return Result.ok({
      tenant: toTenantDto(tenant),
      ...(adminUserDto ? { adminUser: adminUserDto } : {}),
      inheritedProviders: effectiveProviders.map((p) => ({
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
    });
  }
}

export interface UpdateTenantCommand {
  idOrSlug: string;
  name?: string;
  isActive?: boolean;
  config?: Partial<TenantConfig>;
}

export class UpdateTenantUseCase implements UseCase<UpdateTenantCommand, TenantDto> {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute(command: UpdateTenantCommand): Promise<Result<TenantDto>> {
    const tenant = await this.tenantRepo.findByIdOrSlug(command.idOrSlug);
    if (!tenant) {
      return Result.fail('Tenant not found');
    }

    tenant.updateSettings({
      name: command.name,
      isActive: command.isActive,
      config: command.config
    });

    await this.tenantRepo.update(tenant);
    return Result.ok(toTenantDto(tenant));
  }
}

export class GetTenantQuery implements UseCase<{ idOrSlug: string }, TenantDto> {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute(query: { idOrSlug: string }): Promise<Result<TenantDto>> {
    const tenant = await this.tenantRepo.findByIdOrSlug(query.idOrSlug);
    if (!tenant) {
      return Result.fail('Tenant not found');
    }
    return Result.ok(toTenantDto(tenant));
  }
}

export class ListTenantsQuery implements UseCase<void, TenantDto[]> {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async execute(): Promise<Result<TenantDto[]>> {
    const tenants = await this.tenantRepo.listAll();
    return Result.ok(tenants.map(toTenantDto));
  }
}
