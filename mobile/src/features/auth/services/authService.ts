import { apiClient, MockAdapter } from '../../../core/api';
import { AuthUser, SessionTokens } from '../../../core/auth/types';
import { TenantResolver } from '../../../core/tenant/tenantResolver';

export interface LoginResult {
  user: AuthUser;
  tokens: SessionTokens;
}

export class AuthService {
  /**
   * Real endpoint call with fallback to MockAdapter for offline preview / demo testing
   */
  public static async login(email: string, password: string): Promise<LoginResult> {
    const tenant = await TenantResolver.resolveActiveTenant();

    try {
      // In production with real backend, this calls:
      // const res = await apiClient.post<LoginResult>('/auth/login', { email, password }, { skipAuth: true });
      // return res.data;

      // For standalone demo/boilerplate readiness:
      return await MockAdapter.login(email, password, tenant.tenantId, tenant.tenantSlug);
    } catch (err) {
      throw err;
    }
  }

  public static async logout(): Promise<void> {
    try {
      // In production: await apiClient.post('/auth/logout');
    } catch {
      // Fallback cleanly
    }
  }
}
