import React from 'react';
import { View, StyleSheet, Switch, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppHeader, AppCard, AppText, AppIcon, AppDivider } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { useTenant } from '../../core/tenant/TenantContext';
import { useFeatureFlag } from '../../core/features';

export default function SettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['common', 'home']);
  const { theme, isDark, toggleTheme } = useTheme();
  const { tenant } = useTenant();

  const isDarkModeAllowed = useFeatureFlag('darkMode');
  const hasLanguageSwitcher = useFeatureFlag('languageSwitcher');

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      console.warn('Cannot open url:', url);
    }
  };

  return (
    <AppScreen scrollable edges={['top', 'left', 'right']} contentContainerStyle={styles.container}>
      <AppHeader title="Settings" showBack onBack={() => router.back()} />

      <View style={styles.body}>
        {/* Appearance & Preferences */}
        <AppCard variant="elevated" style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Preferences
          </AppText>

          {isDarkModeAllowed && (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <AppIcon name="moon-outline" size="sm" color={theme.colors.primary} />
                <View style={styles.rowText}>
                  <AppText variant="body" weight="medium">
                    Dark Theme
                  </AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    Enable low-light mode
                  </AppText>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          )}

          {isDarkModeAllowed && hasLanguageSwitcher && <AppDivider style={{ marginVertical: 12 }} />}

          {hasLanguageSwitcher && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/language')}
              style={styles.clickableRow}
              accessibilityRole="button"
            >
              <View style={styles.rowLeft}>
                <AppIcon name="globe-outline" size="sm" color={theme.colors.primary} />
                <View style={styles.rowText}>
                  <AppText variant="body" weight="medium">
                    Language
                  </AppText>
                  <AppText variant="caption" color={theme.colors.textMuted}>
                    {i18n.language === 'hi' ? 'हिन्दी (Hindi)' : 'English'}
                  </AppText>
                </View>
              </View>
              <AppIcon name="chevron-forward" size="sm" color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </AppCard>

        {/* Tenant Configuration */}
        <AppCard variant="outlined" style={styles.card}>
          <AppText variant="h3" style={styles.cardTitle}>
            Tenant Details
          </AppText>

          <View style={styles.infoLine}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Organization
            </AppText>
            <AppText variant="body" weight="medium">
              {tenant.displayName} ({tenant.tenantSlug})
            </AppText>
          </View>

          <View style={styles.infoLine}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Industry Profile
            </AppText>
            <AppText variant="body" weight="medium">
              {tenant.industry.toUpperCase()}
            </AppText>
          </View>

          <View style={styles.infoLine}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Support Email
            </AppText>
            <AppText variant="body" weight="medium">
              {tenant.supportEmail}
            </AppText>
          </View>
        </AppCard>

        {/* Legal & Terms */}
        <AppCard variant="flat" style={styles.card}>
          <TouchableOpacity
            onPress={() => openUrl(tenant.termsUrl)}
            style={styles.clickableRow}
            accessibilityRole="link"
          >
            <AppText variant="body">Terms of Service</AppText>
            <AppIcon name="open-outline" size="xs" color={theme.colors.textMuted} />
          </TouchableOpacity>

          <AppDivider style={{ marginVertical: 10 }} />

          <TouchableOpacity
            onPress={() => openUrl(tenant.privacyUrl)}
            style={styles.clickableRow}
            accessibilityRole="link"
          >
            <AppText variant="body">Privacy Policy</AppText>
            <AppIcon name="open-outline" size="xs" color={theme.colors.textMuted} />
          </TouchableOpacity>
        </AppCard>

        {/* App Version Info */}
        <View style={styles.versionContainer}>
          <AppText variant="caption" align="center" color={theme.colors.textMuted}>
            Enterprise Mobile Platform v1.0.0
          </AppText>
          <AppText variant="caption" align="center" color={theme.colors.textMuted}>
            Multi-Tenant White-Label Core
          </AppText>
        </View>
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
  card: {
    padding: 16,
  },
  cardTitle: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clickableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    marginLeft: 12,
  },
  infoLine: {
    marginBottom: 10,
  },
  versionContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
});
