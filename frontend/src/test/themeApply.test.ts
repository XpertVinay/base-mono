import { describe, it, expect } from 'vitest';
import { applyThemeTokens } from '../core/theme/applyTheme';
import { DEMO_TENANTS } from '../core/tenant/registry';

describe('Theme Token Application & White-Label Switching', () => {
  it('should inject CSS custom properties into documentElement for Apex Health', () => {
    const tenant = DEMO_TENANTS['apex-health']!;
    applyThemeTokens(tenant.branding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe(tenant.branding.primaryColor);
    expect(root.style.getPropertyValue('--color-secondary')).toBe(tenant.branding.secondaryColor);
    expect(root.style.getPropertyValue('--color-surface')).toBe(tenant.branding.surfaceColor);
    expect(root.style.getPropertyValue('--font-family')).toBe(tenant.branding.fontFamily);
    expect(root.style.getPropertyValue('--radius-md')).toBe(tenant.branding.borderRadius);
    expect(root.style.getPropertyValue('--color-primary-container')).toBe(tenant.branding.primaryColor);
  });

  it('should dynamically re-theme when switching to Nexus Logistics (Orange Theme)', () => {
    const tenant = DEMO_TENANTS['nexus-logistics']!;
    applyThemeTokens(tenant.branding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#ea580c');
    expect(root.style.getPropertyValue('--color-secondary')).toBe('#f59e0b');
    expect(root.style.getPropertyValue('--color-background')).toBe('#0f1115');
    expect(root.style.getPropertyValue('--color-surface')).toBe('#1a1d24');
    expect(root.style.getPropertyValue('--color-primary-container')).toBe('#ea580c');
  });

  it('should dynamically re-theme when switching to Aura Capital (Purple Theme)', () => {
    const tenant = DEMO_TENANTS['aura-fintech']!;
    applyThemeTokens(tenant.branding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#6366f1');
    expect(root.style.getPropertyValue('--color-secondary')).toBe('#10b981');
    expect(root.style.getPropertyValue('--color-background')).toBe('#090d16');
    expect(root.style.getPropertyValue('--color-surface')).toBe('#111827');
    expect(root.style.getPropertyValue('--radius-md')).toBe('12px');
  });
});
