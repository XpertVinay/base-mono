import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppText, AppCard, AppIcon, AppHeader } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuth } from '../../features/auth';
import { useFeatureFlag } from '../../core/features';
import { formatCurrency, formatDate } from '../../core/i18n';
import { TenantSwitcherModal } from '../../features/tenant';

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation(['home', 'common']);
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [showTenantModal, setShowTenantModal] = useState(false);

  // Check tenant feature flags
  const hasProfile = useFeatureFlag('profile');
  const hasLanguageSwitcher = useFeatureFlag('languageSwitcher');
  const hasNotifications = useFeatureFlag('notifications');
  const hasOrderTracking = useFeatureFlag('orderTracking');
  const hasAppointmentBooking = useFeatureFlag('appointmentBooking');
  const hasInventorySearch = useFeatureFlag('inventorySearch');

  return (
    <AppScreen scrollable edges={['top', 'left', 'right']} contentContainerStyle={styles.container}>
      <AppHeader
        title={tenant.displayName}
        subtitle={tenant.tagline}
        showBack={false}
        rightAction={
          <TouchableOpacity
            onPress={() => setShowTenantModal(true)}
            style={[styles.tenantButton, { backgroundColor: theme.colors.surfaceSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Switch Tenant"
          >
            <AppIcon name="color-palette-outline" size="sm" color={theme.colors.primary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.body}>
        {/* Welcome Banner */}
        <AppCard variant="elevated" style={styles.welcomeBanner}>
          <View style={styles.bannerHeader}>
            <View>
              <AppText variant="h2">{t('home:greeting', { name: user?.fullName || 'User' })}</AppText>
              <AppText variant="caption" color={theme.colors.textSecondary}>
                {formatDate(new Date(), i18n.language, { weekday: 'long', month: 'short', day: 'numeric' })}
              </AppText>
            </View>
            <View
              style={[
                styles.industryTag,
                { backgroundColor: theme.colors.surfaceSubtle, borderColor: theme.colors.border },
              ]}
            >
              <AppText variant="caption" weight="semibold" color={theme.colors.primary}>
                {tenant.industry.toUpperCase()}
              </AppText>
            </View>
          </View>
        </AppCard>

        {/* Demo KPI Summary Widget showing locale-aware currency and metrics */}
        <View style={styles.metricsRow}>
          <AppCard variant="flat" style={styles.metricCard}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Balance / Quota
            </AppText>
            <AppText variant="h3" color={theme.colors.primary} weight="bold">
              {formatCurrency(12480, tenant.currencyCode, i18n.language)}
            </AppText>
          </AppCard>

          <AppCard variant="flat" style={styles.metricCard}>
            <AppText variant="caption" color={theme.colors.textMuted}>
              Active Services
            </AppText>
            <AppText variant="h3" weight="bold">
              {Object.values(tenant.enabledFeatures).filter(Boolean).length} Online
            </AppText>
          </AppCard>
        </View>

        {/* Feature Shortcuts Grid - Dynamically configured by Tenant Feature Flags */}
        <View style={styles.sectionHeader}>
          <AppText variant="h3">{t('home:quickActions')}</AppText>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Configured for {tenant.displayName}
          </AppText>
        </View>

        <View style={styles.shortcutsGrid}>
          {hasProfile && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/profile')}
              style={[
                styles.shortcutItem,
                { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                <AppIcon name="person-outline" size="md" color={theme.colors.primary} />
              </View>
              <AppText variant="label">{t('home:profile')}</AppText>
            </TouchableOpacity>
          )}

          {hasLanguageSwitcher && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/language')}
              style={[
                styles.shortcutItem,
                { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.accent}15` }]}>
                <AppIcon name="globe-outline" size="md" color={theme.colors.accent} />
              </View>
              <AppText variant="label">{t('home:language')}</AppText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push('/(protected)/tenant-preview')}
            style={[
              styles.shortcutItem,
              { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.secondary}15` }]}>
              <AppIcon name="color-palette-outline" size="md" color={theme.colors.secondary} />
            </View>
            <AppText variant="label">{t('home:previewBranding')}</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(protected)/settings')}
            style={[
              styles.shortcutItem,
              { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.textMuted}15` }]}>
              <AppIcon name="settings-outline" size="md" color={theme.colors.text} />
            </View>
            <AppText variant="label">{t('home:settings')}</AppText>
          </TouchableOpacity>

          {/* Optional Industry-Specific Feature Shortcuts conditionally rendered via Feature Flags */}
          {hasOrderTracking && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/settings')}
              style={[
                styles.shortcutItem,
                { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                <AppIcon name="cube-outline" size="md" color={theme.colors.primary} />
              </View>
              <AppText variant="label">{t('home:orderTracking')}</AppText>
            </TouchableOpacity>
          )}

          {hasAppointmentBooking && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/settings')}
              style={[
                styles.shortcutItem,
                { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.primary}15` }]}>
                <AppIcon name="calendar-outline" size="md" color={theme.colors.primary} />
              </View>
              <AppText variant="label">{t('home:appointmentBooking')}</AppText>
            </TouchableOpacity>
          )}

          {hasInventorySearch && (
            <TouchableOpacity
              onPress={() => router.push('/(protected)/settings')}
              style={[
                styles.shortcutItem,
                { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.borderLight },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.shortcutIcon, { backgroundColor: `${theme.colors.accent}15` }]}>
                <AppIcon name="barcode-outline" size="md" color={theme.colors.accent} />
              </View>
              <AppText variant="label">{t('home:inventorySearch')}</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Enabled Features Summary */}
        <AppCard variant="outlined" style={styles.featuresCard}>
          <AppText variant="h3" style={{ marginBottom: 12 }}>
            {t('home:activeFeatures')}
          </AppText>
          <View style={styles.featuresList}>
            {Object.entries(tenant.enabledFeatures).map(([key, enabled]) => (
              <View key={key} style={styles.featureItem}>
                <AppIcon
                  name={enabled ? 'checkmark-circle' : 'close-circle-outline'}
                  size="sm"
                  color={enabled ? theme.colors.status.success : theme.colors.textMuted}
                />
                <AppText
                  variant="body"
                  style={[styles.featureText, !enabled && { color: theme.colors.textMuted }]}
                >
                  {key}
                </AppText>
              </View>
            ))}
          </View>
        </AppCard>
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
    padding: 0,
  },
  body: {
    padding: 16,
    gap: 16,
  },
  tenantButton: {
    padding: 8,
    borderRadius: 20,
  },
  welcomeBanner: {
    padding: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  industryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutItem: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featuresCard: {
    marginTop: 4,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 10,
  },
});
