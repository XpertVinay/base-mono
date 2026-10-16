import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error inside ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: 'var(--spacing-2xl)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            margin: 'var(--spacing-lg)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-error-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--spacing-md)',
              color: 'var(--color-error)',
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-xs)' }}>
            Application Encountered an Error
          </h2>
          <p
            style={{
              color: 'var(--color-text-secondary)',
              maxWidth: '480px',
              marginBottom: 'var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {this.state.error?.message || 'An unexpected runtime error occurred within this component.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} />
            <span>Reload Application</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
