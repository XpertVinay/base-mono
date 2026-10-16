export type IndustryType =
  | 'retail'
  | 'healthcare'
  | 'education'
  | 'logistics'
  | 'hospitality'
  | 'finance'
  | 'professional_services'
  | 'generic';

export type FeatureFlagKey =
  | 'profile'
  | 'notifications'
  | 'helpAndSupport'
  | 'languageSwitcher'
  | 'darkMode'
  | 'analytics'
  | 'orderTracking'
  | 'appointmentBooking'
  | 'inventorySearch';

export interface TenantColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
}

export interface TenantTypographyConfig {
  fontFamilyRegular?: string;
  fontFamilyMedium?: string;
  fontFamilyBold?: string;
  baseFontSize?: number;
}

export interface NumberFormatConfig {
  decimalSeparator: string;
  groupingSeparator: string;
  decimalPlaces: number;
}

export interface TenantConfig {
  tenantId: string;
  tenantSlug: string;
  displayName: string;
  tagline?: string;
  industry: IndustryType;
  logo: string;
  splashScreen: {
    backgroundColor: string;
    logo?: string;
  };
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  typography?: TenantTypographyConfig;
  defaultLocale: string;
  supportedLocales: string[];
  defaultCountryCode: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: NumberFormatConfig;
  currencyCode: string;
  enabledFeatures: Record<FeatureFlagKey, boolean>;
  apiBaseUrl: string;
  supportEmail: string;
  supportUrl: string;
  termsUrl: string;
  privacyUrl: string;
}

export interface TenantContextValue {
  tenant: TenantConfig;
  tenantSlug: string;
  availableTenants: TenantConfig[];
  switchTenant: (slug: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}
