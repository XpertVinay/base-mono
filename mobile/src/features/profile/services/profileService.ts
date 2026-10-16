import { AuthUser } from '../../../core/auth/types';
import { MockAdapter } from '../../../core/api';
import { TenantResolver } from '../../../core/tenant/tenantResolver';

export class ProfileService {
  public static async fetchProfile(): Promise<AuthUser> {
    const tenant = await TenantResolver.resolveActiveTenant();
    // In production:
    // const res = await apiClient.get<AuthUser>('/users/me');
    // return res.data;
    return MockAdapter.getProfile(tenant.tenantSlug);
  }
}
