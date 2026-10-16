import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import styles from './Alert.module.css';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className,
  ...props
}) => {
  const icons = {
    info: <Info size={18} className={styles.icon} />,
    warning: <AlertTriangle size={18} className={styles.icon} />,
    error: <AlertCircle size={18} className={styles.icon} />,
    success: <CheckCircle size={18} className={styles.icon} />,
  };

  return (
    <div className={`${styles.alert} ${styles[variant]} ${className || ''}`} role="alert" {...props}>
      {icons[variant]}
      <div className={styles.content}>
        {title && <div className={styles.title}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
};
