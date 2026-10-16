import { z } from 'zod';

export const HexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/;

export const TenantColorSchema = z.string().regex(HexColorRegex, {
  message: 'Must be a valid hex color code (e.g. #2563EB or #FFF)',
});

export const TenantConfigSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID is required'),
  tenantSlug: z
    .string()
    .min(1, 'Tenant slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lower-case alphanumeric with hyphens'),
  displayName: z.string().min(1, 'Display name is required'),
  tagline: z.string().optional(),
  industry: z.enum([
    'retail',
    'healthcare',
    'education',
    'logistics',
    'hospitality',
    'finance',
    'professional_services',
    'generic',
  ]),
  logo: z.string().min(1, 'Logo URI or asset is required'),
  splashScreen: z.object({
    backgroundColor: TenantColorSchema,
    logo: z.string().optional(),
  }),
  primaryColor: TenantColorSchema,
  secondaryColor: TenantColorSchema,
  accentColor: TenantColorSchema,
  backgroundColor: TenantColorSchema,
  surfaceColor: TenantColorSchema,
  textColor: TenantColorSchema,
  typography: z
    .object({
      fontFamilyRegular: z.string().optional(),
      fontFamilyMedium: z.string().optional(),
      fontFamilyBold: z.string().optional(),
      baseFontSize: z.number().min(10).max(24).optional(),
    })
    .optional(),
  defaultLocale: z.string().length(2, 'Locale must be 2 characters (e.g., en, hi)'),
  supportedLocales: z.array(z.string().length(2)).min(1, 'At least one locale must be supported'),
  defaultCountryCode: z.string().length(2, 'Country code must be 2 letters (e.g., US, IN)'),
  dateFormat: z.string().min(3),
  timeFormat: z.enum(['12h', '24h']),
  numberFormat: z.object({
    decimalSeparator: z.string().min(1),
    groupingSeparator: z.string().min(1),
    decimalPlaces: z.number().min(0).max(4),
  }),
  currencyCode: z.string().min(3).max(3),
  enabledFeatures: z.record(z.string(), z.boolean()),
  apiBaseUrl: z.string().url('Must be a valid URL'),
  supportEmail: z.string().email('Must be a valid email'),
  supportUrl: z.string().url('Must be a valid URL'),
  termsUrl: z.string().url('Must be a valid URL'),
  privacyUrl: z.string().url('Must be a valid URL'),
});

export type ValidatedTenantConfig = z.infer<typeof TenantConfigSchema>;

export function validateTenantConfig(config: unknown): {
  success: boolean;
  data?: ValidatedTenantConfig;
  errors?: string[];
} {
  const result = TenantConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}
