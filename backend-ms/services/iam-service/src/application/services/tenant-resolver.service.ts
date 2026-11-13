import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface.js';
import { Tenant } from '../../domain/entities/tenant.entity.js';
import { getMultiTenancyConfig } from '../../shared/presentation/tenant.middleware.js';

export interface ResolvedTenantInput {
  tenantId?: string;
  tenantSlug?: string;
}

export class TenantResolverService {
  constructor(private readonly tenantRepo: ITenantRepository) {}

  async resolve(input: ResolvedTenantInput): Promise<Tenant | null> {
    const cfg = getMultiTenancyConfig();

    if (!cfg.enabled || cfg.mode === 'disabled') {
      const def = await this.tenantRepo.findByIdOrSlug(cfg.defaultTenantId);
      return def || Tenant.reconstitute(
        {
          slug: cfg.defaultTenantId,
          name: 'Default Tenant',
          isActive: true,
          config: {
            allowLocalLogin: true,
            allowFederatedLogin: true,
            autoProvisionUsers: true,
            defaultRole: 'USER',
            allowedEmailDomains: [],
            sessionTtlSeconds: 3600
          }
        },
        cfg.defaultTenantId
      );
    }

    const candidate =
      (input.tenantId && input.tenantId !== cfg.defaultTenantId ? input.tenantId : undefined) ||
      (input.tenantSlug && input.tenantSlug !== cfg.defaultTenantId ? input.tenantSlug : undefined) ||
      input.tenantId ||
      input.tenantSlug;
    if (candidate) {
      const bySlugOrId = await this.tenantRepo.findByIdOrSlug(candidate);
      if (bySlugOrId) return bySlugOrId;
      if (candidate !== cfg.defaultTenantId) {
        return null;
      }
    }

    if (cfg.mode === 'strict') {
      return null;
    }

    return this.tenantRepo.findByIdOrSlug(cfg.defaultTenantId);
  }
}
