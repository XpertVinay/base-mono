/**
 * Formats a numeric currency amount using locale conventions and currency code
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'USD',
  locale: string = 'en'
): string {
  try {
    return new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats a standard number with locale-aware thousand and decimal separators
 */
export function formatNumber(value: number, locale: string = 'en'): string {
  try {
    return new Intl.NumberFormat(locale === 'hi' ? 'hi-IN' : 'en-US').format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats a Date using locale and style options
 */
export function formatDate(
  dateInput: Date | string | number,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    };
    return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-US', defaultOptions).format(date);
  } catch {
    return String(dateInput);
  }
}
