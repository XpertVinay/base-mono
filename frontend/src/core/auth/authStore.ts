import { create } from 'zustand';
import { AuthState, LoginCredentials, User } from './types';
import { iamApi, IamApiError } from '../../features/auth/services/iamApi';
import {
  AuthTokensDto,
  RegisterRequestPayload,
  SloResultDto,
} from '../../features/auth/types/iam.types';
import { decodeJwt } from '../../features/auth/utils/cryptoUtils';
import { AUTH_TOKEN_STORAGE_KEY, setStoredAccessToken } from './tokenStorage';

interface AuthActions {
  login: (credentials: LoginCredentials, tenantId?: string) => Promise<boolean>;
  loginDemoFallback: (credentials: LoginCredentials, tenantId: string) => Promise<boolean>;
  register: (payload: RegisterRequestPayload) => Promise<{ success: boolean; message: string }>;
  setSessionFromTokens: (tokens: AuthTokensDto, mode?: 'live' | 'demo') => User;
  refreshSession: () => Promise<boolean>;
  fetchProfile: () => Promise<User | null>;
  logout: (options?: { allSessions?: boolean; sessionId?: string; postLogoutRedirectUri?: string }) => Promise<SloResultDto | null>;
  setUser: (user: User | null) => void;
}

const STORAGE_AUTH_KEY = AUTH_TOKEN_STORAGE_KEY;
const STORAGE_REFRESH_KEY = 'auth_refresh_token';
const STORAGE_SESSION_ID_KEY = 'auth_sso_session_id';
const STORAGE_EXPIRES_AT_KEY = 'auth_expires_at';
const STORAGE_MODE_KEY = 'auth_connection_mode';
const STORAGE_USER_KEY = 'auth_session_user';

function clearAuthStorage() {
  setStoredAccessToken(null);
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_AUTH_KEY);
  localStorage.removeItem(STORAGE_REFRESH_KEY);
  localStorage.removeItem(STORAGE_SESSION_ID_KEY);
  localStorage.removeItem(STORAGE_EXPIRES_AT_KEY);
  localStorage.removeItem(STORAGE_MODE_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

function buildUserFromTokens(tokens: AuthTokensDto): User {
  const decoded = decodeJwt(tokens.accessToken)?.payload || {};
  const dto = tokens.user;
  const name = dto?.name || String(decoded.name || dto?.email || decoded.email || 'IAM User');
  const email = dto?.email || String(decoded.email || '');
  const role = (dto?.role || decoded.role || 'USER') as User['role'];
  const tenantId = dto?.tenantId || tokens.tenantId || String(decoded.tenantId || 'default');
  const tenantSlug = tokens.tenantSlug || (decoded.tenantSlug ? String(decoded.tenantSlug) : undefined);

  return {
    id: dto?.id || String(decoded.sub || `usr_${Date.now().toString(36)}`),
    email,
    name,
    role,
    tenantId,
    tenantSlug,
    authMethod: dto?.authMethod || tokens.authMethod || (decoded.authMethod ? String(decoded.authMethod) : 'LOCAL'),
    provider: tokens.provider || (decoded.provider ? String(decoded.provider) : undefined),
    isActive: dto?.isActive ?? true,
    createdAt: dto?.createdAt,
    updatedAt: dto?.updatedAt,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
  };
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => {
  let initialToken: string | null = null;
  let initialRefreshToken: string | null = null;
  let initialSessionId: string | null = null;
  let initialExpiresAt: string | null = null;
  let initialMode: 'live' | 'demo' = 'live';
  let initialUser: User | null = null;

  if (typeof window !== 'undefined') {
    initialToken = localStorage.getItem(STORAGE_AUTH_KEY);
    initialRefreshToken = localStorage.getItem(STORAGE_REFRESH_KEY);
    initialSessionId = localStorage.getItem(STORAGE_SESSION_ID_KEY);
    initialExpiresAt = localStorage.getItem(STORAGE_EXPIRES_AT_KEY);
    const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
    if (savedMode === 'demo' || savedMode === 'live') {
      initialMode = savedMode;
    }
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
    refreshToken: initialRefreshToken,
    sessionId: initialSessionId,
    expiresAt: initialExpiresAt,
    authMethod: initialUser?.authMethod || null,
    provider: initialUser?.provider || null,
    connectionMode: initialMode,
    isAuthenticated: !!initialToken && !!initialUser,
    isLoading: false,

    setSessionFromTokens: (tokens: AuthTokensDto, mode: 'live' | 'demo' = 'live'): User => {
      const user = buildUserFromTokens(tokens);
      const expiresAt = new Date(Date.now() + (tokens.expiresIn || 3600) * 1000).toISOString();
      const sessionId = tokens.sessionId || String(decodeJwt(tokens.accessToken)?.payload?.sid || '');

      setStoredAccessToken(tokens.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_AUTH_KEY, tokens.accessToken);
        if (tokens.refreshToken) localStorage.setItem(STORAGE_REFRESH_KEY, tokens.refreshToken);
        if (sessionId) localStorage.setItem(STORAGE_SESSION_ID_KEY, sessionId);
        localStorage.setItem(STORAGE_EXPIRES_AT_KEY, expiresAt);
        localStorage.setItem(STORAGE_MODE_KEY, mode);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      }

      set({
        user,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        sessionId: sessionId || null,
        expiresAt,
        authMethod: user.authMethod || null,
        provider: user.provider || null,
        connectionMode: mode,
        isAuthenticated: true,
        isLoading: false,
      });

      return user;
    },

    login: async (credentials: LoginCredentials, tenantId?: string): Promise<boolean> => {
      set({ isLoading: true });
      try {
        const res = await iamApi.login(
          {
            email: credentials.email,
            password: credentials.password,
            tenantId: tenantId || undefined,
            tenantSlug: credentials.tenantSlug || undefined,
          },
          {
            tenantId: tenantId || undefined,
            tenantSlug: credentials.tenantSlug || undefined,
          }
        );

        get().setSessionFromTokens(res.data, 'live');
        return true;
      } catch (err) {
        set({ isLoading: false });
        // Only allow offline demo fallback when explicitly enabled via env and network is unreachable
        if (
          err instanceof IamApiError &&
          err.status === 0 &&
          import.meta.env.VITE_ENABLE_MOCK_API === 'true'
        ) {
          return get().loginDemoFallback(credentials, tenantId || 'default');
        }
        throw err;
      }
    },

    loginDemoFallback: async (credentials: LoginCredentials, tenantId: string): Promise<boolean> => {
      set({ isLoading: true });
      await new Promise((resolve) => setTimeout(resolve, 250));

      const isAdminEmail = credentials.email.toLowerCase().includes('admin');
      const role = isAdminEmail ? 'ADMIN' : 'USER';
      const name = isAdminEmail ? 'Executive Administrator (Offline Demo)' : 'Operations Specialist (Offline Demo)';
      const now = new Date().toISOString();

      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
      const payload = btoa(
        JSON.stringify({
          sub: `usr_demo_${Date.now().toString(36)}`,
          email: credentials.email,
          name,
          role,
          tenantId,
          authMethod: 'LOCAL',
          aud: 'platform-api',
          sid: `sso_demo_${Date.now().toString(36)}`,
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).replace(/=+$/, '');

      const mockTokens: AuthTokensDto = {
        accessToken: `${header}.${payload}.demo_signature`,
        refreshToken: `refresh_demo_${Date.now()}`,
        expiresIn: 3600,
        tokenType: 'Bearer',
        sessionId: `sso_demo_${Date.now().toString(36)}`,
        tenantId,
        authMethod: 'LOCAL',
        user: {
          id: `usr_demo_${Date.now().toString(36)}`,
          email: credentials.email,
          name,
          role,
          tenantId,
          authMethod: 'LOCAL',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      };

      get().setSessionFromTokens(mockTokens, 'demo');
      return true;
    },

    register: async (payload: RegisterRequestPayload) => {
      set({ isLoading: true });
      try {
        const res = await iamApi.register(payload, {
          tenantId: payload.tenantId,
          tenantSlug: payload.tenantSlug,
        });
        set({ isLoading: false });
        return { success: true, message: res.message || 'User registered successfully' };
      } catch (err) {
        set({ isLoading: false });
        throw err;
      }
    },

    refreshSession: async (): Promise<boolean> => {
      const { refreshToken, user, connectionMode } = get();
      if (!refreshToken || connectionMode === 'demo') return false;
      try {
        const res = await iamApi.refreshToken(
          { refreshToken, tenantId: user?.tenantId },
          { tenantId: user?.tenantId }
        );
        get().setSessionFromTokens(res.data, 'live');
        return true;
      } catch {
        return false;
      }
    },

    fetchProfile: async (): Promise<User | null> => {
      const { token, user, connectionMode } = get();
      if (!token || connectionMode === 'demo') return user;
      try {
        const res = await iamApi.getProfile({ token, tenantId: user?.tenantId });
        const dto = res.data;
        const merged: User = {
          ...(user || {
            id: dto.id,
            email: dto.email,
            name: dto.name,
            role: dto.role as User['role'],
            tenantId: dto.tenantId || 'default',
          }),
          id: dto.id,
          email: dto.email,
          name: dto.name,
          role: dto.role as User['role'],
          tenantId: dto.tenantId || user?.tenantId || 'default',
          authMethod: dto.authMethod || user?.authMethod,
          isActive: dto.isActive,
          createdAt: dto.createdAt,
          updatedAt: dto.updatedAt,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(dto.name)}`,
        };
        get().setUser(merged);
        return merged;
      } catch {
        return user;
      }
    },

    logout: async (options) => {
      const { token, user, sessionId, connectionMode } = get();
      let sloResult: SloResultDto | null = null;

      if (token && connectionMode === 'live') {
        try {
          const res = await iamApi.ssoLogout(
            {
              sessionId: options?.sessionId || sessionId || undefined,
              allSessions: options?.allSessions,
              postLogoutRedirectUri: options?.postLogoutRedirectUri,
            },
            { token, tenantId: user?.tenantId }
          );
          sloResult = res.data;
        } catch {
          // Proceed with local logout even if gateway/session already expired
        }
      }

      if (!options?.sessionId || options?.sessionId === sessionId || options?.allSessions) {
        clearAuthStorage();
        set({
          user: null,
          token: null,
          refreshToken: null,
          sessionId: null,
          expiresAt: null,
          authMethod: null,
          provider: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }

      return sloResult;
    },

    setUser: (user: User | null) => {
      if (typeof window !== 'undefined') {
        if (user) {
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        } else {
          localStorage.removeItem(STORAGE_USER_KEY);
        }
      }
      set({ user, isAuthenticated: !!user && !!get().token });
    },
  };
});
