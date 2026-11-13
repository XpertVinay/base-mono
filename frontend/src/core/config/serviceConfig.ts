export type ServiceKey =
  | 'iam'
  | 'audit'
  | 'assets'
  | 'config'
  | 'notifications'
  | 'scheduler'
  | 'orders'
  | 'transactions'
  | 'search'
  | 'inventory'
  | 'ai'
  | 'organizations'
  | 'rbac'
  | 'tenants'
  | 'records'
  | 'health';

export type ExternalServiceKey = 'GRAFANA_URL' | 'PROMETHEUS_URL';

export type EnvRecord = Partial<Record<string, string | undefined>>;

export const SERVICE_CONFIG = {
  GATEWAY_URL: '',
  API_BASE_URL: '/api/v1',
  ENDPOINTS: {
    iam: '/iam',
    audit: '/audit',
    assets: '/assets',
    config: '/config',
    notifications: '/notifications',
    scheduler: '/scheduler',
    orders: '/orders',
    transactions: '/transactions',
    search: '/search',
    inventory: '/inventory',
    ai: '/ai',
    organizations: '/organizations',
    rbac: '/rbac',
    tenants: '/tenants',
    records: '/records',
    health: '/health',
  } as Record<ServiceKey, string>,
  EXTERNAL: {
    GRAFANA_URL: 'http://localhost:3000',
    PROMETHEUS_URL: 'http://localhost:9090',
  } as Record<ExternalServiceKey, string>,
} as const;

export interface ServiceBaseUrlOptions {
  gatewayUrl?: string;
  apiBaseUrl?: string;
  endpoint?: string;
  env?: EnvRecord;
}

function readValidValue(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePathSegment(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function getEnvSource(env?: EnvRecord): EnvRecord {
  return env ?? (import.meta.env as EnvRecord);
}

/**
 * Resolves the ENV key name for a service's respective endpoint.
 * Example: 'audit' -> 'VITE_AUDIT_ENDPOINT', 'iam' -> 'VITE_IAM_ENDPOINT'
 */
export function getServiceEndpointEnvKey(service: string): string {
  const normalized = service
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return `VITE_${normalized}_ENDPOINT`;
}

/**
 * Resolves the respective endpoint for a service:
 *   overrideEndpoint | ENV.VITE_<SERVICE>_ENDPOINT | SERVICE_CONFIG.ENDPOINTS[service]
 */
export function resolveServiceEndpoint(
  service?: ServiceKey | string,
  overrideEndpoint?: string,
  env?: EnvRecord
): string {
  const envSource = getEnvSource(env);
  const explicit = readValidValue(overrideEndpoint);
  if (explicit) {
    return normalizePathSegment(explicit);
  }

  if (!service) {
    return '';
  }

  const envKey = getServiceEndpointEnvKey(service);
  const envEndpoint = readValidValue(envSource[envKey]);
  if (envEndpoint) {
    return normalizePathSegment(envEndpoint);
  }

  const configEndpoint =
    service in SERVICE_CONFIG.ENDPOINTS
      ? SERVICE_CONFIG.ENDPOINTS[service as ServiceKey]
      : undefined;

  return configEndpoint ? normalizePathSegment(configEndpoint) : normalizePathSegment(service);
}

/**
 * Resolves the gateway + API base prefix:
 *   ENV.VITE_GATEWAY_URL + ENV.VITE_API_BASE_URL
 */
export function resolveApiBaseUrl(
  options: Omit<ServiceBaseUrlOptions, 'endpoint'> = {}
): string {
  const envSource = getEnvSource(options.env);

  const gateway =
    options.gatewayUrl !== undefined
      ? stripTrailingSlashes(options.gatewayUrl.trim())
      : stripTrailingSlashes(
          readValidValue(envSource.VITE_GATEWAY_URL) ?? SERVICE_CONFIG.GATEWAY_URL
        );

  const rawApiBase =
    readValidValue(options.apiBaseUrl) ??
    readValidValue(envSource.VITE_API_BASE_URL) ??
    SERVICE_CONFIG.API_BASE_URL;

  const normalizedApiBase = isAbsoluteUrl(rawApiBase)
    ? stripTrailingSlashes(rawApiBase)
    : normalizePathSegment(rawApiBase);

  if (isAbsoluteUrl(normalizedApiBase)) {
    return normalizedApiBase;
  }

  return gateway ? `${gateway}${normalizedApiBase}` : normalizedApiBase;
}

/**
 * Unifiedly resolves the BaseUrl for any service:
 *   BaseUrl = ENV.VITE_GATEWAY_URL + ENV.VITE_API_BASE_URL + (ENV.VITE_<SERVICE>_ENDPOINT | Config.ENDPOINTS[service])
 *
 * When `service` is omitted and no `endpoint` override is provided, returns `ENV.VITE_GATEWAY_URL + ENV.VITE_API_BASE_URL`.
 * Handles edge cases:
 * - Avoids double slashes or `'undefined'` / `'null'` segments.
 * - Does not prepend `gatewayUrl` when `apiBaseUrl` is already an absolute URL (`http(s)://`).
 * - Does not duplicate `endpoint` when `apiBaseUrl` already ends with that endpoint (e.g. `/api/v1/audit`).
 */
export function resolveServiceBaseUrl(
  service?: ServiceKey | string,
  options: ServiceBaseUrlOptions = {}
): string {
  const envSource = getEnvSource(options.env);
  const apiBase = resolveApiBaseUrl({
    gatewayUrl: options.gatewayUrl,
    apiBaseUrl: options.apiBaseUrl,
    env: envSource,
  });

  const endpoint = resolveServiceEndpoint(service, options.endpoint, envSource);
  if (!endpoint) {
    return apiBase;
  }

  if (apiBase.endsWith(endpoint)) {
    return apiBase;
  }

  return `${apiBase}${endpoint}`;
}

/**
 * Builds a complete URL for a specific path under a service.
 * Example: buildServiceUrl('audit', '/logs') -> 'http://localhost:4000/api/v1/audit/logs'
 */
export function buildServiceUrl(
  service: ServiceKey | string,
  path = '',
  options: ServiceBaseUrlOptions = {}
): string {
  const baseUrl = resolveServiceBaseUrl(service, options);
  const normalizedPath = normalizePathSegment(path);
  return normalizedPath ? `${baseUrl}${normalizedPath}` : baseUrl;
}

/**
 * Resolves base URLs for every registered microservice in SERVICE_CONFIG.ENDPOINTS.
 */
export function getAllServiceBaseUrls(
  options: Omit<ServiceBaseUrlOptions, 'endpoint'> = {}
): Record<ServiceKey, string> {
  const keys = Object.keys(SERVICE_CONFIG.ENDPOINTS) as ServiceKey[];
  const result = {} as Record<ServiceKey, string>;
  for (const key of keys) {
    result[key] = resolveServiceBaseUrl(key, options);
  }
  return result;
}

/**
 * Resolves external observability/tool URLs (Grafana, Prometheus) with ENV + SERVICE_CONFIG fallback.
 */
export function resolveExternalServiceUrl(
  key: ExternalServiceKey,
  overrideUrl?: string,
  env?: EnvRecord
): string {
  const envSource = getEnvSource(env);
  const envKey = `VITE_${key}`;
  return stripTrailingSlashes(
    readValidValue(overrideUrl) ??
      readValidValue(envSource[envKey]) ??
      SERVICE_CONFIG.EXTERNAL[key]
  );
}

/**
 * Determines whether a request URL/endpoint targets a protected route that requires
 * an Authorization Bearer token.
 *
 * Public routes (login, register, token refresh, public OIDC/SSO handoff, public tenant
 * config lookup, and health checks) return `false`; all other service routes return `true`.
 */
export function isProtectedUrl(
  urlOrPath: string,
  options: Omit<ServiceBaseUrlOptions, 'endpoint' | 'gatewayUrl'> = {}
): boolean {
  const envSource = getEnvSource(options.env);

  let pathname: string;
  try {
    pathname = new URL(urlOrPath, 'http://localhost').pathname;
  } catch {
    pathname = urlOrPath.split('?')[0]?.split('#')[0] || '';
  }

  let normalized = normalizePathSegment(pathname);
  if (!normalized) return false;

  const configuredApiBase = normalizePathSegment(
    readValidValue(options.apiBaseUrl) ??
      readValidValue(envSource.VITE_API_BASE_URL) ??
      SERVICE_CONFIG.API_BASE_URL
  );

  // Strip API base prefix (e.g. /api/v1 or /api) when present
  const prefixesToStrip = [configuredApiBase, '/api/v1', '/api'].filter(Boolean);
  for (const prefix of prefixesToStrip) {
    if (normalized === prefix) {
      normalized = '';
      break;
    }
    if (normalized.startsWith(`${prefix}/`)) {
      normalized = normalized.slice(prefix.length);
      break;
    }
  }

  if (!normalized) return false;

  const iamPrefix = resolveServiceEndpoint('iam', undefined, envSource);
  const tenantsPrefix = resolveServiceEndpoint('tenants', undefined, envSource);
  const healthPrefix = resolveServiceEndpoint('health', undefined, envSource);
  const auditPrefix = resolveServiceEndpoint('audit', undefined, envSource);

  const exactPublicRoutes = new Set<string>([
    healthPrefix,
    `${healthPrefix}/detailed`,
    `${tenantsPrefix}/config`,
    `${auditPrefix}/logs`,
    `${auditPrefix}/alerts`,
    `${auditPrefix}/metrics/summary`,
    `${auditPrefix}/config`,
    `${auditPrefix}/grafana/annotations`,
    `${iamPrefix}/login`,
    `${iamPrefix}/register`,
    `${iamPrefix}/refresh`,
    `${iamPrefix}/tenants/config`,
    `${iamPrefix}/oidc/providers`,
    `${iamPrefix}/oidc/authorize`,
    `${iamPrefix}/oidc/callback`,
    `${iamPrefix}/oidc/token-exchange`,
    `${iamPrefix}/sso/redeem`,
    `${iamPrefix}/sso/introspect`,
  ]);

  if (exactPublicRoutes.has(normalized)) {
    return false;
  }

  // Dynamic public OIDC provider callback and backchannel-logout routes
  if (normalized.startsWith(`${iamPrefix}/oidc/`)) {
    const rest = normalized.slice(`${iamPrefix}/oidc/`.length);
    if (/^[^/]+\/(callback|backchannel-logout)$/.test(rest)) {
      return false;
    }
  }

  return true;
}

