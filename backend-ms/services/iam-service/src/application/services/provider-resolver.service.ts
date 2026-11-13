import { IOidcProviderRepository } from '../../domain/repositories/oidc-provider-repository.interface.js';
import { OidcProvider } from '../../domain/entities/oidc-provider.entity.js';
import { getMultiTenancyConfig } from '../../shared/presentation/tenant.middleware.js';

export interface ResolvedProviderResult {
  provider: OidcProvider | null;
  error?: string;
}

export class ProviderResolverService {
  constructor(private readonly providerRepo: IOidcProviderRepository) {}

  async listSystemDefaults(onlyEnabled = false): Promise<OidcProvider[]> {
    if (this.providerRepo.listSystemDefaults) {
      return this.providerRepo.listSystemDefaults(onlyEnabled);
    }
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const items = await this.providerRepo.listByTenant(defaultTenantId, onlyEnabled);
    return items.filter(
      (p) => p.isSystemDefault && (!onlyEnabled || (p.isEnabled && p.approvalStatus === 'APPROVED'))
    );
  }

  async findSystemDefault(idOrSlug: string): Promise<OidcProvider | null> {
    if (this.providerRepo.findSystemDefaultBySlug) {
      const bySlug = await this.providerRepo.findSystemDefaultBySlug(idOrSlug);
      if (bySlug) return bySlug;
    }
    const byId = await this.providerRepo.findById(idOrSlug);
    if (byId && byId.isSystemDefault) return byId;

    const defaults = await this.listSystemDefaults(false);
    const normalized = idOrSlug.trim().toLowerCase();
    return defaults.find((p) => p.id === idOrSlug || p.slug === normalized) || null;
  }

  async resolveForAuth(tenantId: string, providerIdOrSlug: string): Promise<ResolvedProviderResult> {
    const tenantProvider = await this.providerRepo.findByIdOrSlug(tenantId, providerIdOrSlug);

    if (tenantProvider) {
      if (!tenantProvider.isEnabled) {
        return { provider: null, error: `Provider '${tenantProvider.slug}' is disabled for this tenant` };
      }

      const systemParent =
        tenantProvider.parentProviderId
          ? await this.providerRepo.findById(tenantProvider.parentProviderId)
          : tenantProvider.inheritsSystemConfig
            ? await this.findSystemDefault(tenantProvider.slug)
            : null;

      if (tenantProvider.approvalStatus === 'APPROVED') {
        if (tenantProvider.inheritsSystemConfig && systemParent && systemParent.isActiveForAuth()) {
          return { provider: tenantProvider.resolveEffectiveWithSystem(systemParent) };
        }
        return { provider: tenantProvider };
      }

      // Override is PENDING or REJECTED: fall back to approved system default only if inheriting
      if (tenantProvider.inheritsSystemConfig && systemParent && systemParent.isActiveForAuth()) {
        return { provider: systemParent.asInheritedForTenant(tenantId) };
      }

      const reason =
        tenantProvider.approvalStatus === 'PENDING'
          ? `Provider '${tenantProvider.slug}' configuration is pending platform approval`
          : `Provider '${tenantProvider.slug}' configuration was rejected by platform administrator`;
      return { provider: null, error: reason };
    }

    // No tenant-specific record: inherit system default if present
    const sysProvider = await this.findSystemDefault(providerIdOrSlug);
    if (sysProvider && sysProvider.isActiveForAuth()) {
      return { provider: sysProvider.asInheritedForTenant(tenantId) };
    }

    return { provider: null, error: `Federation provider '${providerIdOrSlug}' not found or disabled` };
  }

  async resolveForAuthById(providerId: string, tenantId: string): Promise<ResolvedProviderResult> {
    const direct = await this.providerRepo.findById(providerId);
    if (!direct) {
      return { provider: null, error: 'Federation provider not found' };
    }

    if (direct.tenantId === tenantId) {
      return this.resolveForAuth(tenantId, direct.slug);
    }

    if (direct.isSystemDefault && direct.isActiveForAuth()) {
      // Check if tenant has an override (e.g. disabled or approved override)
      return this.resolveForAuth(tenantId, direct.slug);
    }

    return { provider: null, error: 'Federation provider does not belong to this tenant' };
  }

  async listEffectiveForTenant(tenantId: string): Promise<OidcProvider[]> {
    const defaultTenantId = getMultiTenancyConfig().defaultTenantId;
    const tenantProviders = await this.providerRepo.listByTenant(tenantId, false);

    if (tenantId === defaultTenantId) {
      return tenantProviders.filter((p) => p.isActiveForAuth());
    }

    const systemDefaults = await this.listSystemDefaults(true);
    const systemBySlug = new Map(systemDefaults.map((s) => [s.slug, s]));
    const handledSlugs = new Set<string>();
    const effective: OidcProvider[] = [];

    for (const tp of tenantProviders) {
      handledSlugs.add(tp.slug);
      if (!tp.isEnabled) {
        // Explicitly disabled for this tenant — suppresses system default too
        continue;
      }

      const sysParent = tp.parentProviderId
        ? systemDefaults.find((s) => s.id === tp.parentProviderId) || systemBySlug.get(tp.slug)
        : systemBySlug.get(tp.slug);

      if (tp.approvalStatus === 'APPROVED') {
        effective.push(
          tp.inheritsSystemConfig && sysParent ? tp.resolveEffectiveWithSystem(sysParent) : tp
        );
      } else if (tp.inheritsSystemConfig && sysParent && sysParent.isActiveForAuth()) {
        // Fall back to approved system default while override is pending/rejected
        effective.push(sysParent.asInheritedForTenant(tenantId));
      }
    }

    for (const sys of systemDefaults) {
      if (!handledSlugs.has(sys.slug)) {
        effective.push(sys.asInheritedForTenant(tenantId));
      }
    }

    return effective;
  }
}

