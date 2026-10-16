import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Home } from 'lucide-react';
import { Button } from '../../components/ui/Button/Button';

export const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: 'var(--spacing-2xl)',
      }}
    >
      <HelpCircle size={48} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
      <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: '8px' }}>
        {t('system.notFoundTitle')}
      </h1>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          maxWidth: '440px',
          marginBottom: '24px',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {t('system.notFoundDesc')}
      </p>
      <Button variant="primary" onClick={() => navigate('/')} leftIcon={<Home size={16} />}>
        {t('system.returnHome')}
      </Button>
    </div>
  );
};
