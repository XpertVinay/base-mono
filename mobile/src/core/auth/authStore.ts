import { create } from 'zustand';
import { AuthState, AuthUser, SessionTokens } from './types';
import { SessionManager } from './sessionManager';
import { MockAdapter } from '../api/mockAdapter';
import { TenantResolver } from '../tenant/tenantResolver';

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setError: (error: string | null) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const activeTenant = await TenantResolver.resolveActiveTenant();
      // Using mock adapter with full JWT format
      const { user, tokens } = await MockAdapter.login(
        email,
        password,
        activeTenant.tenantId,
        activeTenant.tenantSlug
      );
      await SessionManager.saveSession(user, tokens);
      set({
        user,
        tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      set({ error: message, isLoading: false, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await SessionManager.clearSession();
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.warn('[AuthStore] Error during logout:', err);
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const [token, user] = await Promise.all([
        SessionManager.getAccessToken(),
        SessionManager.getSavedUser(),
      ]);
      if (token && user) {
        set({
          user,
          tokens: { accessToken: token, refreshToken: '', expiresIn: 3600 },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (err) {
      console.warn('[AuthStore] Failed to restore session:', err);
      set({
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
}));
