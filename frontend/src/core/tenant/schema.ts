import { z } from 'zod';

export const tenantIdentitySchema = z.object({
  id: z.string().min(1, 'Tenant ID is required'),
  slug: z.string().min(1, 'Tenant slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1, 'Display name is required'),
  legalName: z.string().min(1, 'Legal name is required'),
  logoUrl: z.string().min(1, 'Logo URL is required'),
  faviconUrl: z.string().min(1, 'Favicon URL is required'),
  supportEmail: z.string().email('Invalid support email'),
  supportUrl: z.string().min(1, 'Support URL is required'),
  termsUrl: z.string().min(1, 'Terms URL is required'),
  privacyUrl: z.string().min(1, 'Privacy URL is required'),
});

export const tenantBrandingSchema = z.object({
  primaryColor: z.string().min(3),
  secondaryColor: z.string().min(3),
  accentColor: z.string().min(3),
  backgroundColor: z.string().min(3),
  surfaceColor: z.string().min(3),
  textColor: z.string().min(3),
  mutedColor: z.string().min(3),
  borderColor: z.string().min(3),
  fontFamily: z.string().min(1),
  borderRadius: z.string().min(1),
  themeMode: z.enum(['light', 'dark', 'auto']).optional().default('dark'),
});

export const tenantLocalizationSchema = z.object({
  defaultLocale: z.string().min(2),
  supportedLocales: z.array(z.string().min(2)).min(1),
  defaultCountryCode: z.string().length(2),
  defaultTimeZone: z.string().min(1),
  currencyCode: z.string().length(3),
  dateFormat: z.string().min(1),
  timeFormat: z.enum(['12h', '24h']),
  numberFormat: z.object({
    decimalSeparator: z.string().length(1),
    groupingSeparator: z.string().length(1),
    decimalPlaces: z.number().int().min(0).max(4),
  }),
});

export const tenantNavigationItemSchema = z.object({
  key: z.string().min(1),
  labelKey: z.string().min(1),
  path: z.string().min(1),
  icon: z.string().min(1),
  requiredFeature: z.string().optional(),
  roles: z.array(z.string()).optional(),
});

export const tenantDashboardWidgetSchema = z.object({
  id: z.string().min(1),
  widgetType: z.enum(['metrics', 'recent_activity', 'quick_actions', 'industry_highlight']),
  titleKey: z.string().min(1),
  layout: z.object({
    colSpan: z.number().int().min(1).max(12),
    rowSpan: z.number().int().optional(),
  }),
  requiredFeature: z.string().optional(),
});

export const tenantFeaturesSchema = z.object({
  enabledFeatures: z.record(z.boolean()),
  navigationItems: z.array(tenantNavigationItemSchema),
  dashboardWidgets: z.array(tenantDashboardWidgetSchema),
  publicLandingEnabled: z.boolean().optional(),
});

export const tenantRuntimeSchema = z.object({
  apiBaseUrl: z.string().min(1),
  authMode: z.enum(['jwt', 'session', 'oauth2']),
  sessionTimeoutMinutes: z.number().int().positive(),
  publicSettings: z.record(z.unknown()).optional(),
});

export const tenantConfigSchema = z.object({
  identity: tenantIdentitySchema,
  branding: tenantBrandingSchema,
  localization: tenantLocalizationSchema,
  features: tenantFeaturesSchema,
  runtime: tenantRuntimeSchema,
  industry: z.enum(['healthcare', 'logistics', 'fintech', 'retail', 'education', 'generic']),
});

/**
 * Validates a raw tenant configuration object using Zod.
 * Throws a formatted error or returns the typed config.
 */
export function validateTenantConfig(rawConfig: unknown) {
  return tenantConfigSchema.safeParse(rawConfig);
}
