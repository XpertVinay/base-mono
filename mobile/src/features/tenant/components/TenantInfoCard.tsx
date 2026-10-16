import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTenant } from '../../../core/tenant/TenantContext';
import { useTheme } from '../../../core/theme';
import { AppCard, AppText, AppIcon, AppButton } from '../../../components/ui';

export interface TenantInfoCardProps {
  onOpenSwitcher?: () => void;
}

export const TenantInfoCard: React.FC<TenantInfoCardProps> = ({ onOpenSwitcher }) => {
  const { tenant } = useTenant();
  const { theme } = useTheme();

  const enabledCount = Object.values(tenant.enabledFeatures).filter(Boolean).length;

  return (
    <AppCard variant="elevated" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <AppText variant="label" color={theme.colors.primary} weight="bold">
            {tenant.industry.toUpperCase()} WHITE-LABEL
          </AppText>
          <AppText variant="h2">{tenant.displayName}</AppText>
          {tenant.tagline && (
            <AppText variant="caption" color={theme.colors.textSecondary}>
              {tenant.tagline}
            </AppText>
          )}
        </View>
        <View style={[styles.paletteBadge, { backgroundColor: tenant.primaryColor }]} />
      </View>

      <View style={[styles.metaGrid, { borderColor: theme.colors.border }]}>
        <View style={styles.metaItem}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Currency
          </AppText>
          <AppText variant="body" weight="semibold">
            {tenant.currencyCode}
          </AppText>
        </View>

        <View style={styles.metaItem}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Default Locale
          </AppText>
          <AppText variant="body" weight="semibold">
            {tenant.defaultLocale.toUpperCase()}
          </AppText>
        </View>

        <View style={styles.metaItem}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Active Flags
          </AppText>
          <AppText variant="body" weight="semibold">
            {enabledCount} On
          </AppText>
        </View>
      </View>

      {onOpenSwitcher && (
        <AppButton
          title="Switch Tenant Theme"
          onPress={onOpenSwitcher}
          variant="outline"
          size="sm"
          leftIcon={<AppIcon name="color-palette-outline" size="xs" color={theme.colors.primary} />}
          style={styles.switchBtn}
        />
      )}
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
  },
  paletteBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  metaItem: {
    alignItems: 'center',
    flex: 1,
  },
  switchBtn: {
    marginTop: 14,
  },
});
