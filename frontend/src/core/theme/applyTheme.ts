import { TenantBrandingConfig } from '../tenant/types';

/**
 * Converts hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0]! + cleanHex[0]!, 16);
    const g = parseInt(cleanHex[1]! + cleanHex[1]!, 16);
    const b = parseInt(cleanHex[2]! + cleanHex[2]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

/**
 * Adjusts color brightness (simple lighten/darken)
 */
function adjustBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return hex;
  const num = parseInt(cleanHex, 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

/**
 * Injects tenant CSS custom properties into documentElement
 */
export function applyThemeTokens(branding: TenantBrandingConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Primary colors
  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-primary-hover', adjustBrightness(branding.primaryColor, 12));
  root.style.setProperty('--color-primary-subtle', hexToRgba(branding.primaryColor, 0.15));

  // Secondary colors
  root.style.setProperty('--color-secondary', branding.secondaryColor);
  root.style.setProperty('--color-secondary-hover', adjustBrightness(branding.secondaryColor, 12));
  root.style.setProperty('--color-secondary-subtle', hexToRgba(branding.secondaryColor, 0.15));

  // Accent colors
  root.style.setProperty('--color-accent', branding.accentColor);
  root.style.setProperty('--color-accent-hover', adjustBrightness(branding.accentColor, 12));
  root.style.setProperty('--color-accent-subtle', hexToRgba(branding.accentColor, 0.15));

  // Surfaces & Background
  root.style.setProperty('--color-background', branding.backgroundColor);
  root.style.setProperty('--color-surface', branding.surfaceColor);
  root.style.setProperty('--color-surface-hover', adjustBrightness(branding.surfaceColor, 8));

  // Text & Borders
  root.style.setProperty('--color-text', branding.textColor);
  root.style.setProperty('--color-muted', branding.mutedColor);
  root.style.setProperty('--color-border', branding.borderColor);

  // Typography & Geometry
  root.style.setProperty('--font-family', branding.fontFamily);
  root.style.setProperty('--radius-md', branding.borderRadius);

  // Derived radii
  const numericRadius = parseInt(branding.borderRadius, 10) || 8;
  root.style.setProperty('--radius-sm', `${Math.max(2, Math.round(numericRadius * 0.75))}px`);
  root.style.setProperty('--radius-lg', `${Math.round(numericRadius * 1.5)}px`);

  // Theme mode attribute
  root.setAttribute('data-theme', branding.themeMode || 'dark');
}
