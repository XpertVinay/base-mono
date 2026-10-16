import { SessionManager } from '../../src/core/auth/sessionManager';
import { AuthUser, SessionTokens } from '../../src/core/auth/types';

describe('Session Manager and Storage Isolation', () => {
  const dummyUser: AuthUser = {
    id: 'user-001',
    email: 'admin@apex-retail.com',
    fullName: 'Jane Doe',
    role: 'admin',
    tenantId: 'tenant-apex-001',
    tenantSlug: 'apex-retail',
  };

  const dummyTokens: SessionTokens = {
    accessToken: 'test-access-token-123',
    refreshToken: 'test-refresh-token-456',
    expiresIn: 3600,
  };

  it('saves and retrieves user session tokens', async () => {
    await SessionManager.saveSession(dummyUser, dummyTokens);

    const token = await SessionManager.getAccessToken();
    expect(token).toBe('test-access-token-123');

    const user = await SessionManager.getSavedUser();
    expect(user?.email).toBe('admin@apex-retail.com');
    expect(user?.tenantSlug).toBe('apex-retail');
  });

  it('completely wipes session data on clearSession (logout)', async () => {
    await SessionManager.saveSession(dummyUser, dummyTokens);
    await SessionManager.clearSession();

    const token = await SessionManager.getAccessToken();
    expect(token).toBeNull();

    const user = await SessionManager.getSavedUser();
    expect(user).toBeNull();
  });
});
