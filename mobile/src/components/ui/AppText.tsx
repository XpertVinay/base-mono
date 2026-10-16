import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../../core/theme';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label' | 'error';

export interface AppTextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color,
  weight,
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const { theme } = useTheme();

  const getVariantStyle = (): TextStyle => {
    switch (variant) {
      case 'h1':
        return {
          fontSize: theme.typography.fontSizes.xxl,
          lineHeight: theme.typography.lineHeights.xxl,
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.text,
        };
      case 'h2':
        return {
          fontSize: theme.typography.fontSizes.xl,
          lineHeight: theme.typography.lineHeights.xl,
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.text,
        };
      case 'h3':
        return {
          fontSize: theme.typography.fontSizes.lg,
          lineHeight: theme.typography.lineHeights.lg,
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.text,
        };
      case 'caption':
        return {
          fontSize: theme.typography.fontSizes.xs,
          lineHeight: theme.typography.lineHeights.xs,
          fontWeight: theme.typography.weights.regular,
          color: theme.colors.textMuted,
        };
      case 'label':
        return {
          fontSize: theme.typography.fontSizes.sm,
          lineHeight: theme.typography.lineHeights.sm,
          fontWeight: theme.typography.weights.medium,
          color: theme.colors.textSecondary,
        };
      case 'error':
        return {
          fontSize: theme.typography.fontSizes.xs,
          lineHeight: theme.typography.lineHeights.xs,
          fontWeight: theme.typography.weights.medium,
          color: theme.colors.status.error,
        };
      case 'body':
      default:
        return {
          fontSize: theme.typography.fontSizes.md,
          lineHeight: theme.typography.lineHeights.md,
          fontWeight: theme.typography.weights.regular,
          color: theme.colors.text,
        };
    }
  };

  const resolvedWeight = weight ? theme.typography.weights[weight] : undefined;
  const customStyle: TextStyle = {
    textAlign: align,
    ...(color ? { color } : {}),
    ...(resolvedWeight ? { fontWeight: resolvedWeight } : {}),
  };

  return (
    <RNText style={[styles.base, getVariantStyle(), customStyle, style]} {...rest}>
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
