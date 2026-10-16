import { TenantConfig, TenantResolutionResult } from './types';
import { DEMO_TENANTS, DEFAULT_TENANT_SLUG, DEFAULT_TENANT } from './registry';
import { validateTenantConfig } from './schema';

const STORAGE_OVERRIDE_KEY = 'dev_tenant_override';

export interface ResolveTenantOptions {
  hostname?: string;
  pathname?: string;
  search?: string;
  isDev?: boolean;
  tenantLoader?: (slugOrDomain: string) => Promise<TenantConfig | null>;
}

/**
 * Resolves the tenant deterministically following the priority order:
 * 1. Query parameter override (?tenant=slug) in dev mode
 * 2. Local storage override (dev_tenant_override) in dev mode
 * 3. Path-based resolution (/t/:slug)
 * 4. Subdomain resolution (subdomain.example.com or subdomain.localhost)
 * 5. Custom domain mapping
 * 6. Default tenant fallback in development environment
 * 7. Unknown / unavailable tenant failure state
 */
export async function resolveTenant(options: ResolveTenantOptions = {}): Promise<TenantResolutionResult> {
  const isDev = options.isDev ?? import.meta.env.DEV;
  const hostname = options.hostname ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const pathname = options.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const search = options.search ?? (typeof window !== 'undefined' ? window.location.search : '');

  // 1. URL Query parameter override in Dev mode (?tenant=slug)
  if (isDev && search) {
    const params = new URLSearchParams(search);
    const querySlug = params.get('tenant')?.toLowerCase();
    if (querySlug) {
      const match = await fetchTenantBySlug(querySlug, options.tenantLoader);
      if (match) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_OVERRIDE_KEY, querySlug);
        }
        return validateAndFormatResult(match, 'dev_override');
      }
      return {
        tenant: null,
        status: 'unknown',
        source: 'dev_override',
        error: `Development tenant override '${querySlug}' not found in registry.`,
      };
    }
  }

  // 2. LocalStorage override in Dev mode
  if (isDev && typeof window !== 'undefined') {
    const savedSlug = localStorage.getItem(STORAGE_OVERRIDE_KEY);
    if (savedSlug) {
      const match = await fetchTenantBySlug(savedSlug, options.tenantLoader);
      if (match) {
        return validateAndFormatResult(match, 'dev_override');
      }
    }
  }

  // 3. Path-based resolution (/t/:slug or /tenant/:slug)
  const pathMatch = pathname.match(/^\/(?:t|tenant)\/([a-z0-9-]+)/i);
  if (pathMatch && pathMatch[1]) {
    const pathSlug = pathMatch[1].toLowerCase();
    const match = await fetchTenantBySlug(pathSlug, options.tenantLoader);
    if (match) {
      return validateAndFormatResult(match, 'path');
    }
    return {
      tenant: null,
      status: 'unknown',
      source: 'path',
      error: `Tenant '${pathSlug}' specified in URL path was not found.`,
    };
  }

  // 4. Subdomain resolution
  // Handles patterns like: apex-health.example.com, nexus-logistics.localhost, etc.
  const hostParts = hostname.toLowerCase().split('.');
  if (hostParts.length > 1) {
    const possibleSubdomain = hostParts[0];
    if (
      possibleSubdomain &&
      possibleSubdomain !== 'www' &&
      possibleSubdomain !== 'app' &&
      possibleSubdomain !== 'localhost' &&
      possibleSubdomain !== '127'
    ) {
      const match = await fetchTenantBySlug(possibleSubdomain, options.tenantLoader);
      if (match) {
        return validateAndFormatResult(match, 'subdomain');
      }
    }
  }

  // 5. Custom Domain resolution
  // Match full domain against custom domain registry / backend adapter
  if (options.tenantLoader) {
    try {
      const customDomainMatch = await options.tenantLoader(hostname);
      if (customDomainMatch) {
        return validateAndFormatResult(customDomainMatch, 'custom_domain');
      }
    } catch {
      // Continue to next check
    }
  }

  // 6. Default fallback for local development or previews
  if (isDev || hostname === 'localhost' || hostname === '127.0.0.1') {
    const defaultTenant = DEMO_TENANTS[DEFAULT_TENANT_SLUG] || DEFAULT_TENANT;
    return validateAndFormatResult(defaultTenant, 'default');
  }

  // 7. Unknown Tenant in production (do not silently fallback)
  return {
    tenant: null,
    status: 'unknown',
    source: 'none',
    error: `No tenant matching hostname '${hostname}' could be found.`,
  };
}

/**
 * Validates tenant config schema before declaring resolved
 */
function validateAndFormatResult(
  tenant: TenantConfig,
  source: TenantResolutionResult['source']
): TenantResolutionResult {
  const validation = validateTenantConfig(tenant);
  if (!validation.success) {
    console.error('Tenant configuration validation failed:', validation.error.format());
    return {
      tenant: null,
      status: 'invalid',
      source,
      error: `Invalid tenant configuration for ${tenant.identity?.slug || 'unknown'}`,
    };
  }

  return {
    tenant: validation.data,
    status: 'resolved',
    source,
  };
}

/**
 * Loads tenant by slug from loader or fallback demo registry
 */
async function fetchTenantBySlug(
  slug: string,
  loader?: (slug: string) => Promise<TenantConfig | null>
): Promise<TenantConfig | null> {
  if (loader) {
    try {
      const result = await loader(slug);
      if (result) return result;
    } catch {
      // Fallback to demo
    }
  }
  return DEMO_TENANTS[slug] ?? null;
}

/**
 * Applies runtime document metadata and branding for resolved tenant
 */
export function applyTenantMetadata(tenant: TenantConfig): void {
  if (typeof document === 'undefined') return;

  // Title
  document.title = `${tenant.identity.displayName} | Enterprise Portal`;

  // Favicon
  const faviconEl = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (faviconEl && tenant.identity.faviconUrl) {
    faviconEl.href = tenant.identity.faviconUrl;
  }
}
