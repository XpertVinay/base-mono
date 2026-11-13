import { IamRole, AuthMethod } from '../../features/auth/types/iam.types';

export type UserRole = IamRole | 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  tenantSlug?: string;
  authMethod?: AuthMethod | string;
  provider?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  expiresAt: string | null;
  authMethod: string | null;
  provider: string | null;
  connectionMode: 'live' | 'demo';
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}
