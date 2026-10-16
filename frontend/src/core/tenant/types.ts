export type IndustryType =
  | 'healthcare'
  | 'logistics'
  | 'fintech'
  | 'retail'
  | 'education'
  | 'generic';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type StandardFeatureKey =
  | 'analytics'
  | 'records'
  | 'notifications'
  | 'userManagement'
  | 'auditLogs'
  | 'exports'
  | 'billing'
  | 'developerSettings';

export interface TenantIdentityConfig {
  id: string;
  slug: string;
  displayName: string;
  legalName: string;
  logoUrl: string;
  faviconUrl: string;
  supportEmail: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
}

export interface TenantBrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  fontFamily: string;
  borderRadius: string;
  themeMode?: ThemeMode;
}

export interface TenantLocalizationConfig {
  defaultLocale: string;
  supportedLocales: string[];
  defaultCountryCode: string;
  defaultTimeZone: string;
  currencyCode: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: {
    decimalSeparator: string;
    groupingSeparator: string;
    decimalPlaces: number;
  };
}

export interface TenantNavigationItem {
  key: string;
  labelKey: string;
  path: string;
  icon: string;
  requiredFeature?: string;
  roles?: string[];
}

export interface TenantDashboardWidget {
  id: string;
  widgetType: 'metrics' | 'recent_activity' | 'quick_actions' | 'industry_highlight';
  titleKey: string;
  layout: {
    colSpan: number; // 1-12
    rowSpan?: number;
  };
  requiredFeature?: string;
}

export interface TenantFeaturesConfig {
  enabledFeatures: Record<string, boolean>;
  navigationItems: TenantNavigationItem[];
  dashboardWidgets: TenantDashboardWidget[];
  publicLandingEnabled?: boolean;
}

export interface TenantRuntimeConfig {
  apiBaseUrl: string;
  authMode: 'jwt' | 'session' | 'oauth2';
  sessionTimeoutMinutes: number;
  publicSettings?: Record<string, unknown>;
}

export interface TenantConfig {
  identity: TenantIdentityConfig;
  branding: TenantBrandingConfig;
  localization: TenantLocalizationConfig;
  features: TenantFeaturesConfig;
  runtime: TenantRuntimeConfig;
  industry: IndustryType;
}

export interface TenantResolutionResult {
  tenant: TenantConfig | null;
  status: 'resolved' | 'unknown' | 'invalid' | 'loading' | 'error';
  source: 'subdomain' | 'custom_domain' | 'path' | 'dev_override' | 'default' | 'none';
  error?: string;
}

export interface TenantContextValue {
  tenant: TenantConfig;
  tenantSlug: string;
  availableTenants: TenantConfig[];
  switchTenant: (slug: string) => void;
  isFeatureEnabled: (featureKey: string) => boolean;
  status: TenantResolutionResult['status'];
  error?: string;
}
