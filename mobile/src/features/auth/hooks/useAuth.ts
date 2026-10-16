import { useAuthStore } from '../../../core/auth/authStore';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    restoreSession,
  };
}
