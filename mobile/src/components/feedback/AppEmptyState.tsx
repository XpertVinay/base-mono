import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../core/theme';
import { AppText } from '../ui/AppText';
import { AppIcon } from '../ui/AppIcon';
import { AppButton } from '../ui/AppButton';

export interface AppEmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export const AppEmptyState: React.FC<AppEmptyStateProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionTitle,
  onAction,
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.colors.surfaceSubtle },
        ]}
      >
        <AppIcon name={icon} size="xl" color={theme.colors.textMuted} />
      </View>
      <AppText variant="h3" align="center" style={styles.title}>
        {title}
      </AppText>
      {description && (
        <AppText
          variant="body"
          align="center"
          color={theme.colors.textSecondary}
          style={styles.description}
        >
          {description}
        </AppText>
      )}
      {actionTitle && onAction && (
        <AppButton
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="sm"
          style={styles.actionButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 20,
    maxWidth: 280,
  },
  actionButton: {
    minWidth: 140,
  },
});
