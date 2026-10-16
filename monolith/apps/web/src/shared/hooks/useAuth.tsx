import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserDto, LoginRequestDto, RegisterRequestDto, AuthTokensDto } from '@monolith/contracts';
import { apiClient } from '../api/api-client.js';

interface AuthContextType {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (credentials: LoginRequestDto) => Promise<{ success: boolean; error?: string }>;
  register: (payload: RegisterRequestDto) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDto | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  });

  const login = async (credentials: LoginRequestDto) => {
    const res = await apiClient.post<AuthTokensDto>('/api/iam/login', credentials);
    if (res.success && res.data) {
      setToken(res.data.accessToken);
      setUser(res.data.user);
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('auth_user', JSON.stringify(res.data.user));
      return { success: true };
    }
    return { success: false, error: res.error?.message || 'Login failed' };
  };

  const register = async (payload: RegisterRequestDto) => {
    const res = await apiClient.post<UserDto>('/api/iam/register', payload);
    if (res.success && res.data) {
      // Automatically log in after registration
      return login({ email: payload.email, password: payload.password });
    }
    return { success: false, error: res.error?.message || 'Registration failed' };
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const refreshProfile = async () => {
    if (!token) return;
    const res = await apiClient.get<UserDto>('/api/iam/me');
    if (res.success && res.data) {
      setUser(res.data);
      localStorage.setItem('auth_user', JSON.stringify(res.data));
    }
  };

  useEffect(() => {
    if (token) {
      refreshProfile();
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        login,
        register,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
