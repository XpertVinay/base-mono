import { describe, it, expect } from 'vitest';
import { applyThemeTokens } from '../core/theme/applyTheme';
import { DEMO_TENANTS } from '../core/tenant/registry';

describe('Theme Token Application', () => {
  it('should inject CSS custom properties into documentElement', () => {
    const tenant = DEMO_TENANTS['apex-health']!;
    applyThemeTokens(tenant.branding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe(tenant.branding.primaryColor);
    expect(root.style.getPropertyValue('--color-secondary')).toBe(tenant.branding.secondaryColor);
    expect(root.style.getPropertyValue('--color-surface')).toBe(tenant.branding.surfaceColor);
    expect(root.style.getPropertyValue('--font-family')).toBe(tenant.branding.fontFamily);
    expect(root.style.getPropertyValue('--radius-md')).toBe(tenant.branding.borderRadius);
  });
});
