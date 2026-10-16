import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';
import { AppIcon } from './AppIcon';
import { useTenant } from '../../core/tenant/TenantContext';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  showTenantBadge?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  showTenantBadge = true,
}) => {
  const router = useRouter();
  const { theme } = useTheme();
  const { tenant } = useTenant();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          height: theme.componentHeights.header,
        },
      ]}
    >
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <AppIcon name="chevron-back" size="md" color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <AppText variant="h3" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle && (
            <AppText variant="caption" numberOfLines={1}>
              {subtitle}
            </AppText>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        {showTenantBadge && (
          <View
            style={[
              styles.tenantBadge,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={[styles.tenantDot, { backgroundColor: theme.colors.primary }]} />
            <AppText variant="caption" style={{ color: theme.colors.textSecondary }}>
              {tenant.displayName}
            </AppText>
          </View>
        )}
        {rightAction}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  titleColumn: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  tenantDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
});
