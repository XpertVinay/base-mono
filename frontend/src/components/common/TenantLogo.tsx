import React from 'react';
import { useTenant } from '../../core/tenant/TenantContext';

interface TenantLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const TenantLogo: React.FC<TenantLogoProps> = ({ size = 36, showText = true, className = '' }) => {
  const { tenant } = useTenant();

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        userSelect: 'none',
      }}
    >
      <img
        src={tenant.identity.logoUrl}
        alt={`${tenant.identity.displayName} Logo`}
        width={size}
        height={size}
        style={{
          borderRadius: '8px',
          objectFit: 'contain',
        }}
        onError={(e) => {
          // Fallback if image fails
          e.currentTarget.style.display = 'none';
        }}
      />
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: 'var(--color-text)',
              lineHeight: 1.2,
              fontFamily: 'var(--font-family-heading)',
            }}
          >
            {tenant.identity.displayName}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {tenant.industry} platform
          </span>
        </div>
      )}
    </div>
  );
};
