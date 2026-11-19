import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastStore, ToastVariant } from './toastStore';
import styles from './Toast.module.css';

const ToastIcons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} className={styles.icon} />,
  error: <AlertCircle size={18} className={styles.icon} />,
  info: <Info size={18} className={styles.icon} />,
  warning: <AlertTriangle size={18} className={styles.icon} />,
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer} aria-live="polite" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toastItem} ${styles[toast.variant]}`}
          role="status"
        >
          {ToastIcons[toast.variant]}
          <span className={styles.message}>{toast.message}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
