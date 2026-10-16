import { formatCurrency, formatNumber, formatDate } from '../../src/core/i18n/formatters';

describe('i18n Formatters', () => {
  it('formats USD currency correctly for English locale', () => {
    const formatted = formatCurrency(1250.5, 'USD', 'en');
    expect(formatted).toContain('1,250.50');
    expect(formatted).toContain('$');
  });

  it('formats INR currency correctly for Hindi locale', () => {
    const formatted = formatCurrency(50000, 'INR', 'hi');
    expect(formatted).toContain('50,000');
    expect(formatted).toContain('₹');
  });

  it('formats standard numbers with separators', () => {
    const num = formatNumber(1000000, 'en');
    expect(num).toBe('1,000,000');
  });

  it('formats dates consistently', () => {
    const testDate = new Date('2026-10-16T12:00:00Z');
    const formattedEn = formatDate(testDate, 'en');
    expect(formattedEn).toContain('2026');
  });
});
