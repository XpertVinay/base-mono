import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';

const LOCALE_LABELS: Record<string, string> = {
  'en-US': 'English',
  'en': 'English',
  'es-ES': 'Español',
  'es': 'Español',
  'de-DE': 'Deutsch',
  'de': 'Deutsch',
  'fr-FR': 'Français',
  'fr': 'Français',
};

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();
  const { tenant } = useTenant();

  const supported = tenant.localization.supportedLocales || ['en-US'];

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const fullLocale = e.target.value;
    const langCode = fullLocale.split('-')[0] || 'en';
    i18n.changeLanguage(langCode);
  };

  const currentLang = i18n.language;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '4px 8px',
        fontSize: 'var(--font-size-xs)',
      }}
    >
      <Globe size={14} style={{ color: 'var(--color-muted)' }} />
      <select
        value={
          supported.find((l) => l.startsWith(currentLang)) ||
          supported[0] ||
          'en-US'
        }
        onChange={handleLanguageChange}
        aria-label="Select Language"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text)',
          fontSize: 'var(--font-size-xs)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {supported.map((locale) => (
          <option
            key={locale}
            value={locale}
            style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            {LOCALE_LABELS[locale] || locale}
          </option>
        ))}
      </select>
    </div>
  );
};
