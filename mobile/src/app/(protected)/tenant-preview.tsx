import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppHeader, AppCard, AppText, AppButton, AppIcon, AppDivider } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { useTenant } from '../../core/tenant/TenantContext';
import { TenantSwitcherModal, TenantInfoCard } from '../../features/tenant';

export default function TenantPreviewScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const [showModal, setShowModal] = useState(false);

  return (
    <AppScreen scrollable edges={['top', 'left', 'right']} contentContainerStyle={styles.container}>
      <AppHeader title="Tenant Branding Preview" showBack onBack={() => router.back()} />

      <View style={styles.body}>
        <TenantInfoCard onOpenSwitcher={() => setShowModal(true)} />

        {/* Color Palette Tokens Preview */}
        <AppCard variant="elevated" style={styles.sectionCard}>
          <AppText variant="h3" style={{ marginBottom: 12 }}>
            Generated Design Tokens
          </AppText>
          <View style={styles.paletteGrid}>
            <View style={styles.paletteItem}>
              <View style={[styles.colorBox, { backgroundColor: theme.colors.primary }]} />
              <AppText variant="caption" weight="medium">Primary</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{theme.colors.primary}</AppText>
            </View>

            <View style={styles.paletteItem}>
              <View style={[styles.colorBox, { backgroundColor: theme.colors.secondary }]} />
              <AppText variant="caption" weight="medium">Secondary</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{theme.colors.secondary}</AppText>
            </View>

            <View style={styles.paletteItem}>
              <View style={[styles.colorBox, { backgroundColor: theme.colors.accent }]} />
              <AppText variant="caption" weight="medium">Accent</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{theme.colors.accent}</AppText>
            </View>

            <View style={styles.paletteItem}>
              <View style={[styles.colorBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }]} />
              <AppText variant="caption" weight="medium">Surface</AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>{theme.colors.surface}</AppText>
            </View>
          </View>
        </AppCard>

        {/* Endpoint & Support Info */}
        <AppCard variant="outlined" style={styles.sectionCard}>
          <AppText variant="h3" style={{ marginBottom: 12 }}>
            Tenant Integration Endpoints
          </AppText>

          <View style={styles.row}>
            <AppText variant="caption" color={theme.colors.textMuted}>API Base URL</AppText>
            <AppText variant="body" weight="medium">{tenant.apiBaseUrl}</AppText>
          </View>
          <AppDivider style={{ marginVertical: 8 }} />

          <View style={styles.row}>
            <AppText variant="caption" color={theme.colors.textMuted}>Support Contact</AppText>
            <AppText variant="body" weight="medium">{tenant.supportEmail}</AppText>
          </View>
          <AppDivider style={{ marginVertical: 8 }} />

          <View style={styles.row}>
            <AppText variant="caption" color={theme.colors.textMuted}>Legal & Compliance</AppText>
            <AppText variant="caption" color={theme.colors.primary}>
              {tenant.termsUrl}
            </AppText>
          </View>
        </AppCard>

        <AppButton
          title="Switch Demo Tenant"
          onPress={() => setShowModal(true)}
          variant="primary"
          leftIcon={<AppIcon name="color-palette-outline" size="sm" color={theme.colors.primaryContrast} />}
        />
      </View>

      <TenantSwitcherModal visible={showModal} onClose={() => setShowModal(false)} />
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
  sectionCard: {
    padding: 16,
  },
  paletteGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paletteItem: {
    alignItems: 'center',
    flex: 1,
  },
  colorBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginBottom: 6,
  },
  row: {
    gap: 4,
  },
});
