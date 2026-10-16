import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'error';
  withDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  withDot = false,
  className,
  ...props
}) => {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className || ''}`} {...props}>
      {withDot && <span className={styles.dot} />}
      {children}
    </span>
  );
};
