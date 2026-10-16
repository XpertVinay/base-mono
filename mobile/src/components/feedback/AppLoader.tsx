import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from '../ui/AppText';

export interface AppLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export const AppLoader: React.FC<AppLoaderProps> = ({ message, fullScreen = false }) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        fullScreen ? styles.fullScreen : styles.inline,
        { backgroundColor: fullScreen ? theme.colors.background : 'transparent' },
      ]}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message && (
        <AppText
          variant="label"
          style={[styles.message, { color: theme.colors.textSecondary }]}
        >
          {message}
        </AppText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  inline: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 12,
  },
});
