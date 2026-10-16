import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppText, AppButton, AppIcon } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { useTenant } from '../../core/tenant/TenantContext';
import { TenantSwitcherModal } from '../../features/tenant';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation(['common', 'auth']);
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [showTenantModal, setShowTenantModal] = useState(false);

  return (
    <AppScreen scrollable contentContainerStyle={styles.container}>
      <View style={styles.topBar}>
        <View
          style={[
            styles.industryBadge,
            { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
          ]}
        >
          <View style={[styles.industryDot, { backgroundColor: theme.colors.primary }]} />
          <AppText variant="caption" weight="semibold">
            {tenant.industry.toUpperCase()}
          </AppText>
        </View>

        <AppButton
          title={t('common:switchTenant')}
          onPress={() => setShowTenantModal(true)}
          variant="outline"
          size="sm"
          leftIcon={<AppIcon name="color-palette-outline" size="xs" color={theme.colors.primary} />}
        />
      </View>

      <View style={styles.heroSection}>
        <View
          style={[
            styles.logoContainer,
            {
              backgroundColor: theme.colors.surfaceCard,
              borderColor: theme.colors.borderLight,
              ...theme.elevation.md,
            },
          ]}
        >
          {tenant.logo ? (
            <Image source={{ uri: tenant.logo }} style={styles.logoImage} />
          ) : (
            <AppIcon name="business" size="xl" color={theme.colors.primary} />
          )}
        </View>

        <AppText variant="h1" align="center" style={styles.brandTitle}>
          {tenant.displayName}
        </AppText>

        <AppText
          variant="body"
          align="center"
          color={theme.colors.textSecondary}
          style={styles.tagline}
        >
          {tenant.tagline || 'Enterprise Multi-Tenant Mobile Platform'}
        </AppText>
      </View>

      <View
        style={[
          styles.featuresPreview,
          {
            backgroundColor: theme.colors.surfaceCard,
            borderColor: theme.colors.borderLight,
            ...theme.elevation.sm,
          },
        ]}
      >
        <View style={styles.previewRow}>
          <AppIcon name="globe-outline" size="sm" color={theme.colors.primary} />
          <AppText variant="label" style={styles.previewText}>
            Multilingual ({tenant.supportedLocales.join(', ').toUpperCase()})
          </AppText>
        </View>
        <View style={styles.previewRow}>
          <AppIcon name="shield-checkmark-outline" size="sm" color={theme.colors.primary} />
          <AppText variant="label" style={styles.previewText}>
            Enterprise White-Label Security
          </AppText>
        </View>
        <View style={styles.previewRow}>
          <AppIcon name="options-outline" size="sm" color={theme.colors.primary} />
          <AppText variant="label" style={styles.previewText}>
            Dynamic Tenant Config & Feature Flags
          </AppText>
        </View>
      </View>

      <View style={styles.actionSection}>
        <AppButton
          title={t('common:getStarted')}
          onPress={() => router.push('/(public)/login')}
          variant="primary"
          size="lg"
          style={styles.actionBtn}
        />
        <AppButton
          title={t('common:login')}
          onPress={() => router.push('/(public)/login')}
          variant="secondary"
          size="md"
          style={styles.actionBtn}
        />
      </View>

      <TenantSwitcherModal
        visible={showTenantModal}
        onClose={() => setShowTenantModal(false)}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  industryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  industryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 20,
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  brandTitle: {
    marginBottom: 8,
  },
  tagline: {
    maxWidth: 320,
  },
  featuresPreview: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginVertical: 20,
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewText: {
    marginLeft: 12,
  },
  actionSection: {
    gap: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  actionBtn: {
    width: '100%',
  },
});
