/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_TRUSTED_API_ORIGINS: string;
  readonly VITE_TENANT_RESOLUTION_STRATEGY: string;
  readonly VITE_DEFAULT_TENANT: string;
  readonly VITE_ENABLE_MOCK_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
