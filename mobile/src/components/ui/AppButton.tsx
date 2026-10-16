import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  const getButtonStyles = (): { container: ViewStyle; text: TextStyle; indicatorColor: string } => {
    let height = theme.componentHeights.button;
    let fontSize = theme.typography.fontSizes.md;

    if (size === 'sm') {
      height = 36;
      fontSize = theme.typography.fontSizes.sm;
    } else if (size === 'lg') {
      height = 54;
      fontSize = theme.typography.fontSizes.lg;
    }

    let backgroundColor: string = theme.colors.primary;
    let textColor: string = theme.colors.primaryContrast;
    let borderColor: string | undefined;
    let borderWidth: number | undefined;
    let indicatorColor: string = theme.colors.primaryContrast;

    switch (variant) {
      case 'secondary':
        backgroundColor = theme.colors.surfaceSubtle;
        textColor = theme.colors.text;
        indicatorColor = theme.colors.text;
        break;
      case 'outline':
        backgroundColor = 'transparent';
        borderWidth = 1.5;
        borderColor = theme.colors.primary;
        textColor = theme.colors.primary;
        indicatorColor = theme.colors.primary;
        break;
      case 'text':
        backgroundColor = 'transparent';
        textColor = theme.colors.primary;
        indicatorColor = theme.colors.primary;
        break;
      case 'danger':
        backgroundColor = theme.colors.status.error;
        textColor = '#FFFFFF';
        indicatorColor = '#FFFFFF';
        break;
      case 'primary':
      default:
        backgroundColor = theme.colors.primary;
        textColor = theme.colors.primaryContrast;
        indicatorColor = theme.colors.primaryContrast;
        break;
    }

    const containerStyle: ViewStyle = {
      borderRadius: theme.radii.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      opacity: disabled || loading ? 0.6 : 1,
      height,
      backgroundColor,
      ...(borderColor ? { borderColor } : {}),
      ...(borderWidth ? { borderWidth } : {}),
    };

    const textStyle: TextStyle = {
      fontWeight: theme.typography.weights.semibold,
      fontSize,
      color: textColor,
    };

    return { container: containerStyle, text: textStyle, indicatorColor };
  };

  const { container, text, indicatorColor } = getButtonStyles();

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[container, style]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <AppText style={text}>{title}</AppText>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
