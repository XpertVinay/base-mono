import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, HelpCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import styles from './ErrorLayout.module.css';

export interface ErrorLayoutProps {
  statusCode: 403 | 404 | 500;
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

const ERROR_PRESETS = {
  403: {
    title: 'Access Denied',
    message:
      'Your account role does not have sufficient permissions to access this protected resource. Please switch to an authorized role or contact your tenant administrator.',
    icon: ShieldAlert,
    iconColor: 'var(--color-warning, #f59e0b)',
    badgeClass: 'badge_warning',
  },
  404: {
    title: 'Page Not Found',
    message:
      'The page or entity you requested does not exist or has been relocated within the service catalog.',
    icon: HelpCircle,
    iconColor: 'var(--color-primary, #4f46e5)',
    badgeClass: 'badge_primary',
  },
  500: {
    title: 'Server Error',
    message:
      'An unexpected system error occurred while processing your request. Our telemetry logging has recorded this incident.',
    icon: AlertTriangle,
    iconColor: 'var(--color-danger, #ef4444)',
    badgeClass: 'badge_danger',
  },
};

export const ErrorLayout: React.FC<ErrorLayoutProps> = ({
  statusCode,
  title,
  message,
  actionText,
  onAction,
  children,
}) => {
  const navigate = useNavigate();
  const preset = ERROR_PRESETS[statusCode] || ERROR_PRESETS[404];
  const IconComponent = preset.icon;

  const displayTitle = title || preset.title;
  const displayMessage = message || preset.message;
  const displayActionText = actionText || 'Return to Dashboard';

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate('/');
    }
  };

  return (
    <div className={styles.errorContainer} data-testid="error-layout">
      <div className={styles.errorCard}>
        {/* Status Code Badge */}
        <div className={`${styles.statusBadge} ${styles[preset.badgeClass]}`}>
          <span>HTTP {statusCode}</span>
        </div>

        {/* Big Icon */}
        <div className={styles.iconCircle} style={{ color: preset.iconColor }}>
          <IconComponent size={44} aria-hidden="true" />
        </div>

        {/* Heading & Explanation */}
        <h1 className={styles.title}>{displayTitle}</h1>
        <p className={styles.message}>{displayMessage}</p>

        {/* Custom Content Slot */}
        {children && <div className={styles.customContent}>{children}</div>}

        {/* Action Button */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleAction}
          aria-label={displayActionText}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{displayActionText}</span>
        </button>
      </div>
    </div>
  );
};
