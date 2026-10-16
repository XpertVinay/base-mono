import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';
import { AppIcon } from './AppIcon';

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const AppModal: React.FC<AppModalProps> = ({ visible, onClose, title, children }) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.contentContainer,
                {
                  backgroundColor: theme.colors.surface,
                  borderRadius: theme.radii.lg,
                  borderColor: theme.colors.border,
                  ...theme.elevation.lg,
                },
              ]}
            >
              {(Boolean(title) || typeof onClose === 'function') && (
                <View style={styles.header}>
                  <AppText variant="h3">{title || ''}</AppText>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Close dialog"
                  >
                    <AppIcon name="close" size="md" color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.body}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  body: {},
});
