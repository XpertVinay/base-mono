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
  const isDark =
    branding.themeMode === 'dark' ||
    branding.backgroundColor.startsWith('#0') ||
    branding.backgroundColor.startsWith('#1');

  // Primary colors
  root.style.setProperty('--color-primary', branding.primaryColor);
  root.style.setProperty('--color-primary-hover', adjustBrightness(branding.primaryColor, isDark ? 12 : -12));
  root.style.setProperty('--color-primary-container', branding.primaryColor);
  root.style.setProperty('--color-primary-subtle', hexToRgba(branding.primaryColor, isDark ? 0.2 : 0.12));
  root.style.setProperty('--color-primary-fixed', hexToRgba(branding.primaryColor, isDark ? 0.22 : 0.15));
  root.style.setProperty(
    '--color-on-primary-fixed',
    isDark ? '#ffffff' : adjustBrightness(branding.primaryColor, -35)
  );
  root.style.setProperty('--color-primary-contrast', '#ffffff');

  // Secondary colors
  root.style.setProperty('--color-secondary', branding.secondaryColor);
  root.style.setProperty('--color-secondary-hover', adjustBrightness(branding.secondaryColor, isDark ? 12 : -12));
  root.style.setProperty('--color-secondary-container', branding.secondaryColor);
  root.style.setProperty('--color-secondary-subtle', hexToRgba(branding.secondaryColor, isDark ? 0.2 : 0.12));
  root.style.setProperty('--color-secondary-fixed', hexToRgba(branding.secondaryColor, isDark ? 0.22 : 0.15));
  root.style.setProperty(
    '--color-on-secondary-fixed',
    isDark ? '#ffffff' : adjustBrightness(branding.secondaryColor, -35)
  );

  // Accent colors
  root.style.setProperty('--color-accent', branding.accentColor);
  root.style.setProperty('--color-accent-hover', adjustBrightness(branding.accentColor, isDark ? 12 : -12));
  root.style.setProperty('--color-accent-subtle', hexToRgba(branding.accentColor, isDark ? 0.2 : 0.12));

  // Surfaces & Background (Layered M3 tiers computed from tenant colors)
  root.style.setProperty('--color-background', branding.backgroundColor);
  root.style.setProperty('--color-surface', branding.surfaceColor);
  root.style.setProperty(
    '--color-surface-lowest',
    isDark ? adjustBrightness(branding.surfaceColor, -3) : '#ffffff'
  );
  root.style.setProperty(
    '--color-surface-low',
    isDark ? adjustBrightness(branding.surfaceColor, -2) : adjustBrightness(branding.surfaceColor, -2)
  );
  root.style.setProperty(
    '--color-surface-container',
    isDark ? adjustBrightness(branding.surfaceColor, 5) : adjustBrightness(branding.surfaceColor, -4)
  );
  root.style.setProperty(
    '--color-surface-high',
    isDark ? adjustBrightness(branding.surfaceColor, 10) : adjustBrightness(branding.surfaceColor, -6)
  );
  root.style.setProperty(
    '--color-surface-highest',
    isDark ? adjustBrightness(branding.surfaceColor, 15) : adjustBrightness(branding.surfaceColor, -9)
  );
  root.style.setProperty(
    '--color-surface-hover',
    adjustBrightness(branding.surfaceColor, isDark ? 8 : -4)
  );
  root.style.setProperty(
    '--color-surface-subtle',
    adjustBrightness(branding.surfaceColor, isDark ? 4 : -3)
  );

  // Text & Borders
  root.style.setProperty('--color-text', branding.textColor);
  root.style.setProperty('--color-text-secondary', branding.mutedColor);
  root.style.setProperty(
    '--color-muted',
    isDark ? adjustBrightness(branding.mutedColor, -12) : adjustBrightness(branding.mutedColor, 15)
  );
  root.style.setProperty('--color-border', branding.borderColor);
  root.style.setProperty('--color-border-subtle', hexToRgba(branding.borderColor, 0.6));

  // Header & Focus Ring
  root.style.setProperty('--header-bg', hexToRgba(branding.surfaceColor, 0.85));
  root.style.setProperty(
    '--focus-ring',
    `0 0 0 1px ${branding.surfaceColor}, 0 0 0 3px ${hexToRgba(branding.primaryColor, 0.45)}`
  );
  root.style.setProperty(
    '--shadow-primary',
    `0 2px 6px ${hexToRgba(branding.primaryColor, 0.35)}`
  );

  // Typography & Geometry
  root.style.setProperty('--font-family', branding.fontFamily);
  root.style.setProperty('--font-family-heading', branding.fontFamily);
  root.style.setProperty('--radius-md', branding.borderRadius);

  // Derived radii
  const numericRadius = parseInt(branding.borderRadius, 10) || 8;
  root.style.setProperty('--radius-xs', `${Math.max(2, Math.round(numericRadius * 0.35))}px`);
  root.style.setProperty('--radius-sm', `${Math.max(3, Math.round(numericRadius * 0.6))}px`);
  root.style.setProperty('--radius-lg', `${Math.round(numericRadius * 1.35)}px`);
  root.style.setProperty('--radius-xl', `${Math.round(numericRadius * 1.8)}px`);

  // Theme mode attribute
  root.setAttribute('data-theme', branding.themeMode || 'dark');
}
