import {
  EnvRecord,
  SERVICE_CONFIG,
  ServiceBaseUrlOptions,
  resolveExternalServiceUrl,
  resolveServiceBaseUrl
} from '../../core/config/serviceConfig.js';

export interface AuditMonitoringConfig {
  GATEWAY_URL: string;
  API_BASE_URL: string;
  AUDIT_ENDPOINT: string;
  GRAFANA_URL: string;
  PROMETHEUS_URL: string;
}

export const AUDIT_CONFIG: AuditMonitoringConfig = {
  GATEWAY_URL: SERVICE_CONFIG.GATEWAY_URL,
  API_BASE_URL: SERVICE_CONFIG.API_BASE_URL,
  AUDIT_ENDPOINT: SERVICE_CONFIG.ENDPOINTS.audit,
  GRAFANA_URL: SERVICE_CONFIG.EXTERNAL.GRAFANA_URL,
  PROMETHEUS_URL: SERVICE_CONFIG.EXTERNAL.PROMETHEUS_URL
};

export type BaseUrlResolutionInput = ServiceBaseUrlOptions;

/**
 * Unifiedly resolves the Audit Monitoring BaseUrl via the shared service configuration helper:
 *   BaseUrl = ENV.VITE_GATEWAY_URL + ENV.VITE_API_BASE_URL + (ENV.VITE_AUDIT_ENDPOINT | Config.ENDPOINTS.audit)
 */
export function resolveAuditBaseUrl(input: BaseUrlResolutionInput = {}): string {
  return resolveServiceBaseUrl('audit', input);
}

export function resolveGrafanaUrl(overrideUrl?: string, env?: EnvRecord): string {
  return resolveExternalServiceUrl('GRAFANA_URL', overrideUrl, env);
}

export function resolvePrometheusUrl(overrideUrl?: string, env?: EnvRecord): string {
  return resolveExternalServiceUrl('PROMETHEUS_URL', overrideUrl, env);
}


