import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from '../ui/AppText';
import { AppIcon } from '../ui/AppIcon';
import { AppButton } from '../ui/AppButton';

export interface AppErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryTitle?: string;
}

export const AppError: React.FC<AppErrorProps> = ({
  title = 'Something Went Wrong',
  message,
  onRetry,
  retryTitle = 'Try Again',
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${theme.colors.status.error}15` },
        ]}
      >
        <AppIcon name="alert-circle-outline" size="xl" color={theme.colors.status.error} />
      </View>
      <AppText variant="h3" style={styles.title} align="center">
        {title}
      </AppText>
      <AppText variant="body" style={styles.message} color={theme.colors.textSecondary} align="center">
        {message}
      </AppText>
      {onRetry && (
        <AppButton
          title={retryTitle}
          onPress={onRetry}
          variant="outline"
          size="sm"
          style={styles.retryButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  message: {
    marginBottom: 20,
    maxWidth: 300,
  },
  retryButton: {
    minWidth: 140,
  },
});
