# Multilingual & Internationalization (i18n)

## 1. Overview

The platform uses `i18next` and `react-i18next` with namespace-based resource separation. Initial support includes **English (`en`)** and **Hindi (`hi`)**.

The architecture guarantees:
- Zero hardcoded user-facing strings in reusable components.
- Safe fallback to English (`fallbackLng: 'en'`) if a translation key is missing.
- Runtime language switching with automatic persistence.
- Dynamic adaptation of tenant-specific default locales.

---

## 2. Namespace Organization

Locale resources are organized by domain in `locales/<lang>/`:
- `common.json`: Generic application actions, buttons, dialog labels, language names.
- `auth.json`: Login labels, email/password placeholders, validation errors.
- `home.json`: Dashboard greetings, metric labels, feature shortcut titles.

Example usage in components:
```tsx
const { t } = useTranslation(['common', 'auth']);

<AppButton title={t('common:login')} onPress={handleLogin} />
```

---

## 3. How to Add a New Language (e.g., Spanish `es` or Arabic `ar`)

1. Create the new locale folder and translation files:
   - `locales/es/common.json`
   - `locales/es/auth.json`
   - `locales/es/home.json`

2. Register the language in `src/core/i18n/translations.ts`:
   ```ts
   import esCommon from '../../../locales/es/common.json';
   import esAuth from '../../../locales/es/auth.json';
   import esHome from '../../../locales/es/home.json';

   export const resources = {
     en: { ... },
     hi: { ... },
     es: {
       common: esCommon,
       auth: esAuth,
       home: esHome,
     },
   };

   export const supportedLanguages = [
     { code: 'en', label: 'English', nativeLabel: 'English' },
     { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
     { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
   ];
   ```

3. Update the tenant configuration `supportedLocales` array:
   ```ts
   supportedLocales: ['en', 'hi', 'es']
   ```

---

## 4. Locale-Aware Formatting Utilities

All numbers, currencies, and dates are formatted via centralized helpers in `src/core/i18n/formatters.ts`:

- `formatCurrency(amount, currencyCode, locale)`:
  - `formatCurrency(1250.5, 'USD', 'en')` => `$1,250.50`
  - `formatCurrency(50000, 'INR', 'hi')` => `₹50,000.00`
- `formatDate(date, locale, options)`: Formats dates according to locale conventions.
- `formatNumber(value, locale)`: Formats numbers with correct thousand and decimal grouping.
