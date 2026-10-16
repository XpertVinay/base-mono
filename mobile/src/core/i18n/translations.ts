import enCommon from '../../../locales/en/common.json';
import enAuth from '../../../locales/en/auth.json';
import enHome from '../../../locales/en/home.json';

import hiCommon from '../../../locales/hi/common.json';
import hiAuth from '../../../locales/hi/auth.json';
import hiHome from '../../../locales/hi/home.json';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    home: enHome,
  },
  hi: {
    common: hiCommon,
    auth: hiAuth,
    home: hiHome,
  },
} as const;

export type SupportedLanguage = 'en' | 'hi';
export const supportedLanguages: { code: SupportedLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];
