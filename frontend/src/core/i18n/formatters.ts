import { TenantLocalizationConfig } from '../tenant/types';

/**
 * Formats a currency amount using tenant localization configuration and Intl.NumberFormat
 */
export function formatCurrency(
  amount: number,
  localization: TenantLocalizationConfig,
  overrideLocale?: string
): string {
  const locale = overrideLocale || localization.defaultLocale;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currencyCode,
      minimumFractionDigits: localization.numberFormat.decimalPlaces,
      maximumFractionDigits: localization.numberFormat.decimalPlaces,
    }).format(amount);
  } catch {
    // Fallback format
    return `${localization.currencyCode} ${amount.toFixed(localization.numberFormat.decimalPlaces)}`;
  }
}

/**
 * Formats a number with group separators and decimals
 */
export function formatNumber(
  value: number,
  localization: TenantLocalizationConfig,
  overrideLocale?: string
): string {
  const locale = overrideLocale || localization.defaultLocale;
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: localization.numberFormat.decimalPlaces,
      maximumFractionDigits: localization.numberFormat.decimalPlaces,
    }).format(value);
  } catch {
    return value.toString();
  }
}

/**
 * Formats a date string or object according to tenant configuration
 */
export function formatDate(
  dateInput: Date | string | number,
  localization: TenantLocalizationConfig,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: localization.defaultTimeZone,
  };

  try {
    return new Intl.DateTimeFormat(localization.defaultLocale, defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats time according to tenant 12h or 24h preference
 */
export function formatTime(
  dateInput: Date | string | number,
  localization: TenantLocalizationConfig
): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const hourCycle = localization.timeFormat === '12h' ? 'h12' : 'h23';

  try {
    return new Intl.DateTimeFormat(localization.defaultLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle,
      timeZone: localization.defaultTimeZone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}
