import React from 'react';
import { Spinner } from '../../components/ui/Spinner/Spinner';

export const TenantLoadingPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b0f19',
        color: '#f8fafc',
        gap: '16px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <Spinner size={36} color="#6366f1" />
      <div style={{ fontSize: '0.875rem', color: '#94a3b8', letterSpacing: '0.02em' }}>
        Resolving Tenant Configuration & Branding...
      </div>
    </div>
  );
};
