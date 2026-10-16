import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { useTenant } from '../../core/tenant/TenantContext';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { Alert } from '../../components/ui/Alert/Alert';
import styles from './LoginPage.module.css';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@demo.com',
      password: 'password123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const success = await login(data, tenant.identity.id);
      if (success) {
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
        navigate(from, { replace: true });
      }
    } catch {
      setAuthError(t('auth.invalidCredentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const populateDemoUser = (role: 'admin' | 'operator') => {
    if (role === 'admin') {
      setValue('email', `admin@${tenant.identity.slug}.demo`);
      setValue('password', 'secretAdmin2026!');
    } else {
      setValue('email', `operator@${tenant.identity.slug}.demo`);
      setValue('password', 'operatorAccess2026!');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        {authError && <Alert variant="error">{authError}</Alert>}

        <Input
          label={t('common.email')}
          type="email"
          placeholder="user@enterprise.com"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <Input
          label={t('common.password')}
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          required
          {...register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          rightIcon={<ArrowRight size={16} />}
        >
          {t('common.login')}
        </Button>
      </form>

      <div className={styles.helperBox}>
        <div className={styles.helperTitle}>{t('auth.demoHelper')}</div>
        <div className={styles.demoButtons}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => populateDemoUser('admin')}
            leftIcon={<Lock size={12} />}
          >
            {t('auth.adminUser')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => populateDemoUser('operator')}
            leftIcon={<Mail size={12} />}
          >
            {t('auth.standardUser')}
          </Button>
        </div>
      </div>
    </div>
  );
};
