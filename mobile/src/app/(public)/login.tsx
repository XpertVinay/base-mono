import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppText, AppIcon } from '../../components/ui';
import { LoginForm } from '../../features/auth';
import { useTheme } from '../../core/theme';
import { useTenant } from '../../core/tenant/TenantContext';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation(['auth', 'common']);
  const { theme } = useTheme();
  const { tenant } = useTenant();

  const handleLoginSuccess = () => {
    router.replace('/(protected)/home');
  };

  return (
    <AppScreen scrollable contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <AppIcon name="chevron-back" size="md" color={theme.colors.text} />
        </TouchableOpacity>

        <View
          style={[
            styles.tenantPill,
            { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
          <AppText variant="caption" weight="semibold">
            {tenant.displayName}
          </AppText>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleSection}>
          <AppText variant="h1">{t('auth:title')}</AppText>
          <AppText variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
            {t('auth:subtitle')}
          </AppText>
        </View>

        <LoginForm onSuccess={handleLoginSuccess} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backButton: {
    padding: 6,
  },
  tenantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 28,
  },
  subtitle: {
    marginTop: 6,
  },
});
