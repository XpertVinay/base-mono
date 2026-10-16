import {
  generateThemeTokens,
  getContrastColor,
  adjustBrightness,
} from '../../src/core/theme/themeGenerator';
import { apexRetailTenant } from '../../src/core/tenant/tenants/apexRetail';
import { nexusHealthTenant } from '../../src/core/tenant/tenants/nexusHealth';

describe('Theme Generator & Design Tokens', () => {
  it('calculates proper contrast color for light and dark backgrounds', () => {
    // Pure black should yield white text
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
    // Pure white should yield dark text
    expect(getContrastColor('#FFFFFF')).toBe('#0F172A');
    // Dark blue should yield white text
    expect(getContrastColor('#1E3A8A')).toBe('#FFFFFF');
  });

  it('adjusts brightness accurately', () => {
    const lightened = adjustBrightness('#101010', 50);
    expect(lightened).toBe('#8f8f8f');
  });

  it('generates consistent light theme tokens matching tenant brand', () => {
    const tokens = generateThemeTokens(apexRetailTenant, false);
    expect(tokens.mode).toBe('light');
    expect(tokens.colors.primary).toBe(apexRetailTenant.primaryColor);
    expect(tokens.colors.secondary).toBe(apexRetailTenant.secondaryColor);
    expect(tokens.colors.accent).toBe(apexRetailTenant.accentColor);
    expect(tokens.spacing.md).toBe(16);
    expect(tokens.radii.lg).toBe(16);
  });

  it('generates consistent dark theme tokens with proper dark surfaces', () => {
    const tokens = generateThemeTokens(nexusHealthTenant, true);
    expect(tokens.mode).toBe('dark');
    expect(tokens.colors.background).toBe('#0B0F17');
    expect(tokens.colors.text).toBe('#F8FAFC');
    expect(tokens.colors.primary).toBe(nexusHealthTenant.primaryColor);
  });
});
