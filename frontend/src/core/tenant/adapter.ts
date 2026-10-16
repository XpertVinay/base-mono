import { TenantConfig } from './types';
import { DEMO_TENANTS } from './registry';
import { validateTenantConfig } from './schema';

// List of trusted origins allowed for API communication
const TRUSTED_ORIGINS = (import.meta.env.VITE_TRUSTED_API_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000')
  .split(',')
  .map((origin: string) => origin.trim().toLowerCase());

/**
 * Validates whether an API base URL belongs to a trusted origin
 */
export function isTrustedApiUrl(url: string): boolean {
  if (url.startsWith('/')) {
    // Relative endpoints on same origin are always trusted
    return true;
  }
  try {
    const parsed = new URL(url);
    return TRUSTED_ORIGINS.includes(parsed.origin.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Backend Tenant Configuration Loader
 * In production, requests configuration from backend API `/api/v1/tenants/resolve?domain=${domain}`
 * In development / offline mode, resolves from DEMO_TENANTS registry.
 */
export async function loadTenantConfigFromBackend(identifier: string): Promise<TenantConfig | null> {
  const isMock = import.meta.env.VITE_ENABLE_MOCK_API === 'true' || import.meta.env.DEV;

  if (isMock) {
    // Check if identifier matches a slug or domain in demo registry
    if (DEMO_TENANTS[identifier]) {
      return DEMO_TENANTS[identifier]!;
    }

    // Try finding by slug
    const tenantBySlug = Object.values(DEMO_TENANTS).find(
      (t) => t.identity.slug === identifier || t.identity.id === identifier
    );
    if (tenantBySlug) return tenantBySlug;

    return null;
  }

  // Production HTTP configuration resolution
  try {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    const response = await fetch(`${apiBase}/tenants/config?identifier=${encodeURIComponent(identifier)}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to load tenant config from backend: HTTP ${response.status}`);
    }

    const data = await response.json();
    const validation = validateTenantConfig(data);

    if (!validation.success) {
      console.error('Remote tenant config failed schema validation:', validation.error);
      return null;
    }

    // Security check: ensure apiBaseUrl is within trusted origins
    if (!isTrustedApiUrl(validation.data.runtime.apiBaseUrl)) {
      console.warn(
        `Tenant apiBaseUrl '${validation.data.runtime.apiBaseUrl}' is not in trusted origins. Falling back to default.`
      );
      validation.data.runtime.apiBaseUrl = apiBase;
    }

    return validation.data;
  } catch (err) {
    console.warn(`Error resolving tenant from backend:`, err);
    return null;
  }
}
