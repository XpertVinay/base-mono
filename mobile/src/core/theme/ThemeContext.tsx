import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContextValue, ThemeMode, ThemeTokens } from './types';
import { generateThemeTokens } from './themeGenerator';
import { useTenant } from '../tenant/TenantContext';
import { appStorage, StorageKeys } from '../storage';
import { isFeatureEnabled } from '../features/featureFlags';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { tenant } = useTenant();
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    async function loadThemeMode() {
      try {
        const stored = await appStorage.getItem(StorageKeys.THEME_MODE);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      } catch (err) {
        console.warn('[ThemeProvider] Failed to load stored theme mode:', err);
      }
    }
    loadThemeMode();
  }, []);

  const setMode = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);
    await appStorage.setItem(StorageKeys.THEME_MODE, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  }, [mode, setMode]);

  const isDarkModeAllowed = isFeatureEnabled(tenant, 'darkMode');

  const isDark = useMemo(() => {
    if (!isDarkModeAllowed) return false;
    if (mode === 'system') {
      return systemColorScheme === 'dark';
    }
    return mode === 'dark';
  }, [mode, systemColorScheme, isDarkModeAllowed]);

  const theme: ThemeTokens = useMemo(() => {
    return generateThemeTokens(tenant, isDark);
  }, [tenant, isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      isDark,
      setMode,
      toggleTheme,
    }),
    [theme, mode, isDark, setMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
