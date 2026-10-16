import { AuthUser, SessionTokens } from '../auth/types';
import { ApiError } from './apiError';

export interface MockLoginResponse {
  user: AuthUser;
  tokens: SessionTokens;
}

export class MockAdapter {
  public static async login(
    email: string,
    password: string,
    tenantId: string,
    tenantSlug: string
  ): Promise<MockLoginResponse> {
    // Artificial small delay for native feel
    await new Promise((res) => setTimeout(res, 350));

    if (!email || !email.includes('@')) {
      throw new ApiError('Please provide a valid email', 400, 'INVALID_INPUT', {
        email: ['Invalid email address format'],
      });
    }

    if (!password || password.length < 6) {
      throw new ApiError('Password must be at least 6 characters', 400, 'INVALID_INPUT', {
        password: ['Password too short'],
      });
    }

    const nameParts = email.split('@')[0].split('.');
    const fullName = nameParts
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Enterprise User';

    const user: AuthUser = {
      id: `usr-${Date.now().toString(36)}`,
      email,
      fullName,
      role: email.includes('admin') ? 'admin' : 'manager',
      tenantId,
      tenantSlug,
      avatarUrl: `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(fullName)}`,
    };

    const tokens: SessionTokens = {
      accessToken: `mock-jwt-access-${tenantSlug}-${Date.now()}`,
      refreshToken: `mock-jwt-refresh-${tenantSlug}-${Date.now()}`,
      expiresIn: 3600,
    };

    return { user, tokens };
  }

  public static async getProfile(tenantSlug: string): Promise<AuthUser> {
    await new Promise((res) => setTimeout(res, 200));
    return {
      id: 'usr-demo-100',
      email: `admin@${tenantSlug}.com`,
      fullName: 'Demo Enterprise Lead',
      role: 'admin',
      tenantId: `tenant-${tenantSlug}`,
      tenantSlug,
      phoneNumber: '+1 (555) 019-2834',
    };
  }
}
