import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeJwt, generatePkcePair } from '../features/auth/utils/cryptoUtils';
import {
  normalizeRole,
  hasRole,
  isAdmin,
  isSupportOrAdmin,
  isPlatformAdmin,
  getEffectivePermissions,
} from '../core/auth/rbac';
import { iamApi } from '../features/auth/services/iamApi';
import { apiClient } from '../core/api/client';
import { ApiError } from '../core/api/types';

function makeJwt(payloadObj: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payloadObj)}.sig123`;
}

describe('IAM Crypto Utilities', () => {
  it('decodes a valid base64url JWT header, payload, and signature', () => {
    const token = makeJwt({ sub: 'usr_1', email: 'alice@acme.io', role: 'ADMIN', tenantId: 'default' });
    const decoded = decodeJwt(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload.email).toBe('alice@acme.io');
    expect(decoded?.payload.role).toBe('ADMIN');
    expect(decoded?.signature).toBe('sig123');
  });

  it('returns null for malformed JWT tokens', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('a.b')).toBeNull();
  });

  it('generates a PKCE codeVerifier and S256 codeChallenge', async () => {
    const pair = await generatePkcePair();
    expect(pair.codeVerifier.length).toBeGreaterThanOrEqual(40);
    expect(pair.codeChallenge.length).toBeGreaterThanOrEqual(40);
    expect(pair.codeChallenge).not.toContain('=');
    expect(pair.codeVerifier).not.toContain('+');
  });
});

describe('IAM RBAC & Tenant Authorization Matrix', () => {
  it('normalizes legacy frontend roles and IAM backend roles consistently', () => {
    expect(normalizeRole('ADMIN')).toBe('ADMIN');
    expect(normalizeRole('admin')).toBe('ADMIN');
    expect(normalizeRole('SUPPORT')).toBe('SUPPORT');
    expect(normalizeRole('operator')).toBe('SUPPORT');
    expect(normalizeRole('USER')).toBe('USER');
    expect(normalizeRole('viewer')).toBe('USER');
    expect(normalizeRole(undefined)).toBe('USER');
  });

  it('checks hasRole across normalized aliases', () => {
    expect(hasRole('ADMIN', ['admin'])).toBe(true);
    expect(hasRole('operator', ['SUPPORT'])).toBe(true);
    expect(hasRole('USER', ['ADMIN', 'SUPPORT'])).toBe(false);
    expect(hasRole('USER', [])).toBe(true);
  });

  it('distinguishes Platform Admin (default tenant) from Tenant Admin', () => {
    const platformAdmin = {
      id: '1',
      email: 'root@platform.local',
      name: 'Root',
      role: 'ADMIN' as const,
      tenantId: 'default',
    };
    const tenantAdmin = {
      id: '2',
      email: 'admin@acme.local',
      name: 'Tenant Admin',
      role: 'ADMIN' as const,
      tenantId: 'acme-corp',
    };
    const supportUser = {
      id: '3',
      email: 'sup@acme.local',
      name: 'Support',
      role: 'SUPPORT' as const,
      tenantId: 'acme-corp',
    };

    expect(isPlatformAdmin(platformAdmin)).toBe(true);
    expect(isAdmin(platformAdmin)).toBe(true);

    expect(isPlatformAdmin(tenantAdmin)).toBe(false);
    expect(isAdmin(tenantAdmin)).toBe(true);

    expect(isSupportOrAdmin(supportUser)).toBe(true);
    expect(isAdmin(supportUser)).toBe(false);

    const platformMatrix = getEffectivePermissions(platformAdmin);
    const tenantMatrix = getEffectivePermissions(tenantAdmin);
    expect(platformMatrix.every((m) => m.granted)).toBe(true);
    expect(tenantMatrix.find((m) => m.capability.includes('Platform Tenant Onboarding'))?.granted).toBe(false);
  });
});

describe('iamApi StandardResponse & Middleware Error Extraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps StandardResponse envelope on login and forwards tenant context', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      status: 200,
      data: {
        status: true,
        message: 'Login successful',
        data: {
          accessToken: makeJwt({ sub: 'u1', email: 'u@test.io', role: 'USER', tenantId: 'acme' }),
          refreshToken: 'ref_1',
          expiresIn: 3600,
          tokenType: 'Bearer',
          sessionId: 'sso_1',
        },
        errors: [],
        meta_data: { requestId: 'req_1', timestamp: '2026-01-01T00:00:00Z' },
      },
    });

    const result = await iamApi.login(
      { email: 'u@test.io', password: 'Secret123!', tenantSlug: 'acme' },
      { tenantSlug: 'acme' }
    );

    expect(postSpy).toHaveBeenCalledWith(
      '/iam/login',
      { email: 'u@test.io', password: 'Secret123!', tenantSlug: 'acme' },
      { tenantId: undefined, tenantSlug: 'acme' }
    );
    expect(result.message).toBe('Login successful');
    expect(result.data.sessionId).toBe('sso_1');
  });

  it('extracts MiddlewareErrorPayload errors cleanly into IamApiError', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(
      new ApiError('HTTP 403', 403, {
        success: false,
        error: { code: 'FORBIDDEN_ROLE', message: 'Admin role required' },
      })
    );

    await expect(
      iamApi.adminListPendingApprovals({ token: 'tok', tenantId: 'default' })
    ).rejects.toMatchObject({
      name: 'IamApiError',
      status: 403,
      code: 'FORBIDDEN_ROLE',
      message: 'Admin role required',
    });
  });

  it('extracts StandardApiEnvelope errors including further_steps', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue(
      new ApiError('HTTP 409', 409, {
        status: false,
        message: 'Provider requires platform approval',
        errors: [{ code: 'PROVIDER_PENDING_APPROVAL', message: 'Awaiting approval' }],
        meta_data: { further_steps: ['Request approval from platform admin'] },
      })
    );

    await expect(
      iamApi.adminTestDiscovery('prov_1', { token: 'tok', tenantId: 'acme' })
    ).rejects.toMatchObject({
      status: 409,
      code: 'PROVIDER_PENDING_APPROVAL',
      furtherSteps: ['Request approval from platform admin'],
    });
  });
});
