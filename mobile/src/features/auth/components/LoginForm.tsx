import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LoginFormData, LoginSchema } from '../types/auth.types';
import { useAuth } from '../hooks/useAuth';
import { AppInput, AppButton, AppText, AppIcon } from '../../../components/ui';
import { useTheme } from '../../../core/theme';
import { useTenant } from '../../../core/tenant/TenantContext';

export interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation(['auth', 'common']);
  const { theme } = useTheme();
  const { tenant } = useTenant();
  const { login } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    // Validate with Zod
    const validation = LoginSchema.safeParse(data);
    if (!validation.success) {
      setAuthError(validation.error.issues[0]?.message || 'Invalid form input');
      return;
    }

    try {
      setIsSubmitting(true);
      setAuthError(null);
      await login(data.email, data.password);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : t('auth:errors.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setValue('email', `admin@${tenant.tenantSlug}.com`);
    setValue('password', 'password123');
    setAuthError(null);
  };

  return (
    <View style={styles.container}>
      {authError && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: `${theme.colors.status.error}15`,
              borderColor: theme.colors.status.error,
            },
          ]}
        >
          <AppIcon name="alert-circle" size="sm" color={theme.colors.status.error} />
          <AppText variant="caption" style={styles.errorText} color={theme.colors.status.error}>
            {authError}
          </AppText>
        </View>
      )}

      <Controller
        control={control}
        name="email"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <AppInput
            label={t('auth:emailLabel')}
            placeholder={t('auth:emailPlaceholder')}
            value={value}
            onChangeText={onChange}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            error={errors.email?.message}
            leftIcon={<AppIcon name="mail-outline" size="sm" color={theme.colors.textMuted} />}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <AppInput
            label={t('auth:passwordLabel')}
            placeholder={t('auth:passwordPlaceholder')}
            value={value}
            onChangeText={onChange}
            secureTextEntry
            autoCapitalize="none"
            error={errors.password?.message}
            leftIcon={<AppIcon name="lock-closed-outline" size="sm" color={theme.colors.textMuted} />}
          />
        )}
      />

      <AppButton
        title={isSubmitting ? t('auth:submitting') : t('auth:submitButton')}
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        variant="primary"
        style={styles.submitBtn}
      />

      <TouchableOpacity
        onPress={handleFillDemo}
        style={[
          styles.demoButton,
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderColor: theme.colors.border,
          },
        ]}
        accessibilityRole="button"
      >
        <AppIcon name="flash-outline" size="xs" color={theme.colors.primary} />
        <AppText variant="caption" style={{ color: theme.colors.primary, marginLeft: 6 }}>
          {t('auth:demoCredentials')} (admin@{tenant.tenantSlug}.com)
        </AppText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  submitBtn: {
    marginTop: 8,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
});
