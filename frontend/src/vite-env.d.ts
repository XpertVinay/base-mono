/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_IAM_ENDPOINT?: string;
  readonly VITE_AUDIT_ENDPOINT?: string;
  readonly VITE_ASSETS_ENDPOINT?: string;
  readonly VITE_CONFIG_ENDPOINT?: string;
  readonly VITE_NOTIFICATIONS_ENDPOINT?: string;
  readonly VITE_SCHEDULER_ENDPOINT?: string;
  readonly VITE_ORDERS_ENDPOINT?: string;
  readonly VITE_TRANSACTIONS_ENDPOINT?: string;
  readonly VITE_SEARCH_ENDPOINT?: string;
  readonly VITE_INVENTORY_ENDPOINT?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_TENANTS_ENDPOINT?: string;
  readonly VITE_RECORDS_ENDPOINT?: string;
  readonly VITE_HEALTH_ENDPOINT?: string;
  readonly VITE_GRAFANA_URL?: string;
  readonly VITE_PROMETHEUS_URL?: string;
  readonly VITE_TRUSTED_API_ORIGINS: string;
  readonly VITE_TENANT_RESOLUTION_STRATEGY: string;
  readonly VITE_DEFAULT_TENANT: string;
  readonly VITE_ENABLE_MOCK_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
