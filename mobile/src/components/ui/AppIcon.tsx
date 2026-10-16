import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';
import { IconSizeTokens } from '../../core/theme/types';

export type IconSizeKey = keyof IconSizeTokens;

export interface AppIconProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: IconSizeKey | number;
  color?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ name, size = 'md', color }) => {
  const { theme } = useTheme();

  const resolvedSize = typeof size === 'number' ? size : theme.iconSizes[size] || 22;
  const resolvedColor = color || theme.colors.text;

  return <Ionicons name={name} size={resolvedSize} color={resolvedColor} />;
};
