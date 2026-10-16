import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../core/theme';
import { AppText } from './AppText';
import { AppIcon } from './AppIcon';

export interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  secureTextEntry,
  containerStyle,
  placeholder,
  value,
  onChangeText,
  ...rest
}) => {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const isPassword = !!secureTextEntry;
  const showPassword = isPassword && isSecureVisible;

  const borderColor = error
    ? theme.colors.status.error
    : isFocused
    ? theme.colors.primary
    : theme.colors.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.surface,
            borderColor,
            borderRadius: theme.radii.md,
            height: theme.componentHeights.input,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.textInput,
            {
              color: theme.colors.text,
              fontSize: theme.typography.fontSizes.md,
            },
          ]}
          {...rest}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            style={styles.rightIconButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <AppIcon
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size="sm"
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <AppText variant="error" style={styles.feedbackText}>
          {error}
        </AppText>
      ) : helperText ? (
        <AppText variant="caption" style={styles.feedbackText}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    paddingHorizontal: 12,
  },
  leftIconContainer: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    paddingVertical: 0,
    height: '100%',
  },
  rightIconButton: {
    padding: 6,
    marginLeft: 6,
  },
  feedbackText: {
    marginTop: 4,
    marginLeft: 2,
  },
});
