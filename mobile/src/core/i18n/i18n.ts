import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, SupportedLanguage } from './translations';
import { appStorage, StorageKeys } from '../storage';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources,
    lng: 'en',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'home'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export async function initAppLanguage(tenantDefaultLocale: string = 'en'): Promise<string> {
  try {
    const stored = await appStorage.getItem(StorageKeys.LOCALE);
    const chosen = (stored as SupportedLanguage) || (tenantDefaultLocale as SupportedLanguage) || 'en';
    if (i18n.language !== chosen) {
      await i18n.changeLanguage(chosen);
    }
    return chosen;
  } catch (err) {
    console.warn('[i18n] Failed to load language preference:', err);
    return 'en';
  }
}

export async function setAppLanguage(language: SupportedLanguage): Promise<void> {
  try {
    await i18n.changeLanguage(language);
    await appStorage.setItem(StorageKeys.LOCALE, language);
  } catch (err) {
    console.warn('[i18n] Failed to change language:', err);
  }
}

export default i18n;
