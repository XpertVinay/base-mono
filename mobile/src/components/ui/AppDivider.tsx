import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';

export interface AppDividerProps {
  label?: string;
  style?: ViewStyle;
}

export const AppDivider: React.FC<AppDividerProps> = ({ label, style }) => {
  const { theme } = useTheme();

  if (label) {
    return (
      <View style={[styles.labelContainer, style]}>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
        <AppText variant="caption" style={[styles.labelText, { color: theme.colors.textMuted }]}>
          {label}
        </AppText>
        <View style={[styles.line, { backgroundColor: theme.colors.border }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.simpleLine,
        { backgroundColor: theme.colors.border, marginVertical: theme.spacing.md },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  simpleLine: {
    height: 1,
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  line: {
    flex: 1,
    height: 1,
  },
  labelText: {
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
});
