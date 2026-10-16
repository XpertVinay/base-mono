import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTenant } from '../../../core/tenant/TenantContext';
import { useTheme } from '../../../core/theme';
import { AppModal, AppText, AppIcon } from '../../../components/ui';

export interface TenantSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export const TenantSwitcherModal: React.FC<TenantSwitcherModalProps> = ({
  visible,
  onClose,
}) => {
  const { tenant, tenantSlug, availableTenants, switchTenant } = useTenant();
  const { theme } = useTheme();

  const handleSelect = async (slug: string) => {
    await switchTenant(slug);
    onClose();
  };

  return (
    <AppModal visible={visible} onClose={onClose} title="Switch White-Label Tenant">
      <AppText variant="caption" color={theme.colors.textSecondary} style={styles.subtitle}>
        Select a tenant configuration to dynamically preview colors, currency, and feature flags.
      </AppText>

      <View style={styles.list}>
        {availableTenants.map((item) => {
          const isSelected = item.tenantSlug === tenantSlug;
          return (
            <TouchableOpacity
              key={item.tenantSlug}
              onPress={() => handleSelect(item.tenantSlug)}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isSelected ? theme.colors.surfaceSubtle : 'transparent',
                  borderColor: isSelected ? item.primaryColor : theme.colors.border,
                },
              ]}
              accessibilityRole="button"
            >
              <View style={[styles.colorPreview, { backgroundColor: item.primaryColor }]} />
              <View style={styles.textContainer}>
                <AppText variant="body" weight="semibold">
                  {item.displayName}
                </AppText>
                <AppText variant="caption" color={theme.colors.textMuted}>
                  {item.industry.toUpperCase()} • {item.currencyCode} • {item.defaultLocale.toUpperCase()}
                </AppText>
              </View>
              {isSelected && (
                <AppIcon name="checkmark-circle" size="md" color={item.primaryColor} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppModal>
  );
};

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
});
