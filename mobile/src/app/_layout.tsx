import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider, useTenant } from '../core/tenant/TenantContext';
import { ThemeProvider } from '../core/theme/ThemeContext';
import { initAppLanguage } from '../core/i18n/i18n';
import { useAuthStore } from '../core/auth/authStore';
import { AppLoader } from '../components/feedback/AppLoader';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function AppBootstrapper({ children }: { children: React.ReactNode }) {
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const [isI18nReady, setIsI18nReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        await initAppLanguage(tenant.defaultLocale);
      } finally {
        setIsI18nReady(true);
      }
      await restoreSession();
    }
    bootstrap();
  }, [tenant.defaultLocale, restoreSession]);

  if (isTenantLoading || isAuthLoading || !isI18nReady) {
    return <AppLoader fullScreen message="Loading Enterprise Application..." />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <ThemeProvider>
          <AppBootstrapper>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(public)" />
              <Stack.Screen name="(protected)" />
              <Stack.Screen name="+not-found" />
            </Stack>
          </AppBootstrapper>
        </ThemeProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}
