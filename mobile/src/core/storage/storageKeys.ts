export const StorageKeys = {
  TENANT_SLUG: 'app_active_tenant_slug',
  ACCESS_TOKEN: 'app_auth_access_token',
  REFRESH_TOKEN: 'app_auth_refresh_token',
  USER_DATA: 'app_auth_user_data',
  LOCALE: 'app_user_locale',
  THEME_MODE: 'app_theme_mode',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
