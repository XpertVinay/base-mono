import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/api/queryClient';
import { TenantProvider } from './core/tenant/TenantContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';
import { AppRoutes } from './routes';
import './core/i18n';
import './styles/global.css';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
          <BrowserRouter>
            <AppRoutes />
            <ToastContainer />
          </BrowserRouter>
        </TenantProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
