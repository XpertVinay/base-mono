import { create } from 'zustand';
import { AuthState, User, LoginCredentials } from './types';

interface AuthActions {
  login: (credentials: LoginCredentials, tenantId: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const STORAGE_AUTH_KEY = 'auth_session_token';
const STORAGE_USER_KEY = 'auth_session_user';

export const useAuthStore = create<AuthState & AuthActions>((set) => {
  // Initialize state from localStorage if present
  let initialToken: string | null = null;
  let initialUser: User | null = null;

  if (typeof window !== 'undefined') {
    initialToken = localStorage.getItem(STORAGE_AUTH_KEY);
    const savedUser = localStorage.getItem(STORAGE_USER_KEY);
    if (savedUser) {
      try {
        initialUser = JSON.parse(savedUser);
      } catch {
        initialUser = null;
      }
    }
  }

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: !!initialToken && !!initialUser,
    isLoading: false,

    login: async (credentials: LoginCredentials, tenantId: string): Promise<boolean> => {
      set({ isLoading: true });

      // Demo/mock authentication logic
      await new Promise((resolve) => setTimeout(resolve, 300)); // micro latency for realistic UX

      const isAdmin = credentials.email.includes('admin');
      const role = isAdmin ? 'admin' : 'operator';
      const name = isAdmin ? 'Executive Administrator' : 'Operations Specialist';

      const mockUser: User = {
        id: `usr_${Date.now().toString(36)}`,
        email: credentials.email,
        name,
        role,
        tenantId,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
      };

      const mockToken = `jwt_mock_${Date.now()}_${tenantId}`;

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_AUTH_KEY, mockToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(mockUser));
      }

      set({
        user: mockUser,
        token: mockToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    },

    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    },

    setUser: (user: User | null) => {
      if (typeof window !== 'undefined') {
        if (user) {
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      }
      set({ user, isAuthenticated: !!user });
    },
  };
});
