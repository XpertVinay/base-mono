export type UserRole = 'admin' | 'manager' | 'operator' | 'customer';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  tenantSlug: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: SessionTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
