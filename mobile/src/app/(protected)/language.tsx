import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppHeader, AppCard, AppText, AppIcon } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { supportedLanguages, SupportedLanguage, setAppLanguage } from '../../core/i18n';

export default function LanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['common']);
  const { theme } = useTheme();

  const handleLanguageSelect = async (code: SupportedLanguage) => {
    await setAppLanguage(code);
  };

  return (
    <AppScreen scrollable edges={['top', 'left', 'right']} contentContainerStyle={styles.container}>
      <AppHeader title={t('common:selectLanguage')} showBack onBack={() => router.back()} />

      <View style={styles.body}>
        <AppText variant="caption" color={theme.colors.textSecondary} style={styles.helpText}>
          Choose your preferred interface language. The app adapts translations dynamically without requiring a full restart.
        </AppText>

        <View style={styles.langList}>
          {supportedLanguages.map((lang) => {
            const isSelected = i18n.language === lang.code;
            return (
              <AppCard
                key={lang.code}
                variant={isSelected ? 'elevated' : 'outlined'}
                onPress={() => handleLanguageSelect(lang.code)}
                style={[
                  styles.cardItem,
                  isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.langRow}>
                  <View>
                    <AppText variant="body" weight="semibold">
                      {lang.nativeLabel}
                    </AppText>
                    <AppText variant="caption" color={theme.colors.textMuted}>
                      {lang.label}
                    </AppText>
                  </View>
                  {isSelected && (
                    <AppIcon name="checkmark-circle" size="md" color={theme.colors.primary} />
                  )}
                </View>
              </AppCard>
            );
          })}
        </View>

        <AppCard variant="flat" style={styles.infoCard}>
          <AppText variant="label" weight="semibold">
            {t('common:welcome')} • {t('common:appName')}
          </AppText>
          <AppText variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
            Current Locale: {i18n.language.toUpperCase()}
          </AppText>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  body: {
    padding: 16,
    gap: 16,
  },
  helpText: {
    marginBottom: 4,
  },
  langList: {
    gap: 12,
  },
  cardItem: {
    padding: 16,
  },
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCard: {
    marginTop: 12,
    padding: 16,
  },
});
