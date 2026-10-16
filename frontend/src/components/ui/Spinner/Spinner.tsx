import React from 'react';

export interface SpinnerProps {
  size?: number;
  color?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 24, color = 'var(--color-primary)', className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`animate-spin ${className || ''}`}
      style={{ display: 'inline-block' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M12 2C6.47715 2 2 6.47715 2 12"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};
