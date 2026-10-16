import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber } from '../core/i18n/formatters';
import { DEMO_TENANTS } from '../core/tenant/registry';

describe('Locale-Aware Formatters', () => {
  const apexHealth = DEMO_TENANTS['apex-health']!;
  const nexusLogistics = DEMO_TENANTS['nexus-logistics']!;

  it('should format USD currency according to apex-health localization', () => {
    const formatted = formatCurrency(1250.5, apexHealth.localization);
    expect(formatted).toContain('1,250.50');
    expect(formatted).toMatch(/\$|USD/);
  });

  it('should format EUR currency according to nexus-logistics localization', () => {
    const formatted = formatCurrency(2450.75, nexusLogistics.localization, 'de-DE');
    expect(formatted).toContain('2.450,75');
    expect(formatted).toMatch(/€|EUR/);
  });

  it('should format numbers with grouping separators according to locale', () => {
    const formattedUs = formatNumber(1000000, apexHealth.localization);
    expect(formattedUs).toContain('1,000,000');
  });
});
