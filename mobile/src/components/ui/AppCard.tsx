import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../core/theme';

export type CardVariant = 'elevated' | 'outlined' | 'flat';

export interface AppCardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  variant = 'elevated',
  onPress,
  style,
}) => {
  const { theme } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: theme.colors.surfaceCard,
          borderWidth: 1,
          borderColor: theme.colors.border,
        };
      case 'flat':
        return {
          backgroundColor: theme.colors.surfaceSubtle,
        };
      case 'elevated':
      default:
        return {
          backgroundColor: theme.colors.surfaceCard,
          borderWidth: 1,
          borderColor: theme.colors.borderLight,
          ...theme.elevation.sm,
        };
    }
  };

  const containerStyle: ViewStyle = {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    ...getVariantStyle(),
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[containerStyle, style]}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};
