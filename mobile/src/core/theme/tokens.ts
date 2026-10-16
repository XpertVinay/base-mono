import {
  ComponentHeightTokens,
  IconSizeTokens,
  RadiiTokens,
  SpacingTokens,
  TypographyTokens,
} from './types';

export const baseSpacing: SpacingTokens = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const baseRadii: RadiiTokens = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

export const baseTypography: TypographyTokens = {
  fontSizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  lineHeights: {
    xs: 15,
    sm: 18,
    md: 22,
    lg: 26,
    xl: 30,
    xxl: 36,
    display: 42,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const baseIconSizes: IconSizeTokens = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

export const baseComponentHeights: ComponentHeightTokens = {
  button: 48,
  input: 48,
  header: 56,
  avatarSm: 32,
  avatarMd: 44,
  avatarLg: 64,
};

export const baseScreenMargin = 16;
