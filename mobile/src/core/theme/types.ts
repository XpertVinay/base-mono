export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorTokens {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryContrast: string;

  secondary: string;
  secondaryLight: string;
  secondaryDark: string;
  secondaryContrast: string;

  accent: string;
  accentContrast: string;

  background: string;
  surface: string;
  surfaceSubtle: string;
  surfaceCard: string;
  border: string;
  borderLight: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export interface TypographyTokens {
  fontSizes: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    display: number;
  };
  lineHeights: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    display: number;
  };
  weights: {
    regular: '400';
    medium: '500';
    semibold: '600';
    bold: '700';
  };
}

export interface SpacingTokens {
  none: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface RadiiTokens {
  none: number;
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface ElevationTokens {
  none: object;
  sm: object;
  md: object;
  lg: object;
}

export interface IconSizeTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ComponentHeightTokens {
  button: number;
  input: number;
  header: number;
  avatarSm: number;
  avatarMd: number;
  avatarLg: number;
}

export interface ThemeTokens {
  mode: 'light' | 'dark';
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radii: RadiiTokens;
  elevation: ElevationTokens;
  iconSizes: IconSizeTokens;
  componentHeights: ComponentHeightTokens;
  screenMargin: number;
}

export interface ThemeContextValue {
  theme: ThemeTokens;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}
