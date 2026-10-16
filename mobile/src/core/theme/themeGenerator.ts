import { Platform } from 'react-native';
import { TenantConfig } from '../tenant/types';
import {
  baseComponentHeights,
  baseIconSizes,
  baseRadii,
  baseScreenMargin,
  baseSpacing,
  baseTypography,
} from './tokens';
import { ColorTokens, ElevationTokens, ThemeTokens } from './types';

/**
 * Calculates luminance to determine appropriate contrast text color (#FFFFFF or #0F172A)
 */
export function getContrastColor(hexColor: string): string {
  const cleanHex = hexColor.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  // Standard relative luminance formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0F172A' : '#FFFFFF';
}

/**
 * Adjust hex color brightness (positive percent = lighten, negative = darken)
 */
export function adjustBrightness(hexColor: string, percent: number): string {
  const cleanHex = hexColor.replace('#', '');
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hexColor;

  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function createElevations(isDark: boolean): ElevationTokens {
  const shadowColor = isDark ? '#000000' : '#0F172A';
  return {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    sm: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.35 : 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
      default: {
        shadowColor,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
    }),
    md: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.45 : 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
    lg: Platform.select({
      ios: {
        shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.55 : 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {
        shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
    }),
  };
}

export function generateThemeTokens(tenant: TenantConfig, isDark: boolean): ThemeTokens {
  const primaryContrast = getContrastColor(tenant.primaryColor);
  const secondaryContrast = getContrastColor(tenant.secondaryColor);
  const accentContrast = getContrastColor(tenant.accentColor);

  const colors: ColorTokens = isDark
    ? {
        primary: tenant.primaryColor,
        primaryLight: adjustBrightness(tenant.primaryColor, 20),
        primaryDark: adjustBrightness(tenant.primaryColor, -20),
        primaryContrast,

        secondary: tenant.secondaryColor,
        secondaryLight: adjustBrightness(tenant.secondaryColor, 20),
        secondaryDark: adjustBrightness(tenant.secondaryColor, -20),
        secondaryContrast,

        accent: tenant.accentColor,
        accentContrast,

        background: '#0B0F17',
        surface: '#151C28',
        surfaceSubtle: '#1E293B',
        surfaceCard: '#182232',
        border: '#2A3649',
        borderLight: '#1E293B',

        text: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        textInverse: '#0F172A',

        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      }
    : {
        primary: tenant.primaryColor,
        primaryLight: adjustBrightness(tenant.primaryColor, 25),
        primaryDark: adjustBrightness(tenant.primaryColor, -15),
        primaryContrast,

        secondary: tenant.secondaryColor,
        secondaryLight: adjustBrightness(tenant.secondaryColor, 25),
        secondaryDark: adjustBrightness(tenant.secondaryColor, -15),
        secondaryContrast,

        accent: tenant.accentColor,
        accentContrast,

        background: tenant.backgroundColor || '#F8FAFC',
        surface: tenant.surfaceColor || '#FFFFFF',
        surfaceSubtle: '#F1F5F9',
        surfaceCard: '#FFFFFF',
        border: '#E2E8F0',
        borderLight: '#F1F5F9',

        text: tenant.textColor || '#0F172A',
        textSecondary: '#64748B',
        textMuted: '#94A3B8',
        textInverse: '#FFFFFF',

        status: {
          success: '#059669',
          warning: '#D97706',
          error: '#DC2626',
          info: '#2563EB',
        },
      };

  return {
    mode: isDark ? 'dark' : 'light',
    colors,
    typography: baseTypography,
    spacing: baseSpacing,
    radii: baseRadii,
    elevation: createElevations(isDark),
    iconSizes: baseIconSizes,
    componentHeights: baseComponentHeights,
    screenMargin: baseScreenMargin,
  };
}
