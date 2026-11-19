import { apiClient } from '../client';
import { resolveServiceEndpoint } from '../../config/serviceConfig';
import {
  ApiResult,
  RequestContextOptions,
  extractApiServiceError,
  unwrapEnvelope,
} from '../envelope';

export interface MfaSetupResponseDto {
  secret: string;
  otpauthUrl: string;
  qrCode?: string;
  recoveryCodes?: string[];
}

export interface MfaEnablePayload {
  code: string;
  secret: string;
}

export interface MfaVerifyPayload {
  mfaChallengeToken: string;
  code: string;
}

export interface MfaReverifyPayload {
  code: string;
}

export interface MfaStatusResponseDto {
  mfaEnabled: boolean;
  verifiedAt?: string | null;
  isMfaVerifiedSession?: boolean;
  mfaMethod?: 'TOTP' | 'SMS' | 'WEBAUTHN' | null;
  lastUsedAt?: string | null;
}

export interface JwkKeyDto {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

export interface JwksResponseDto {
  keys: JwkKeyDto[];
}

export interface PublicKeyResponseDto {
  publicKey: string;
  keyId?: string;
  algorithm?: string;
}

export interface IamUserDto {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  mfaEnabled?: boolean;
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IamAuditLogDto {
  id: string;
  userId?: string;
  tenantId?: string;
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE';
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface MfaProtectedRouteDto {
  id: string;
  pattern: string;
  method: string;
  description?: string;
  createdAt: string;
}

const iamPath = (subPath = ''): string => `${resolveServiceEndpoint('iam')}${subPath}`;

export const iamApi = {
  /**
   * Initialize RFC 6238 TOTP MFA setup; generates shared secret and otpauth URI
   */
  async setupMfa(options?: RequestContextOptions): Promise<ApiResult<MfaSetupResponseDto>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/setup'), {}, options);
      return unwrapEnvelope<MfaSetupResponseDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Verify TOTP code and activate MFA for the authenticated user
   */
  async enableMfa(
    payload: MfaEnablePayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ enabled: boolean }>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/enable'), payload, options);
      return unwrapEnvelope<{ enabled: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Verify MFA challenge during login or elevated step-up authentication
   */
  async verifyMfa(
    payload: MfaVerifyPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ accessToken: string; refreshToken?: string }>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/verify'), payload, options);
      return unwrapEnvelope<{ accessToken: string; refreshToken?: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Re-verify MFA session to renew the 24-hour verification window
   */
  async reverifyMfa(
    payload: MfaReverifyPayload,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ reVerified: boolean; expiresAt?: string }>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/reverify'), payload, options);
      return unwrapEnvelope<{ reVerified: boolean; expiresAt?: string }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Disable MFA for the authenticated user
   */
  async disableMfa(
    payload: { code: string },
    options?: RequestContextOptions
  ): Promise<ApiResult<{ disabled: boolean }>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/disable'), payload, options);
      return unwrapEnvelope<{ disabled: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Query current user MFA status and session verification flag
   */
  async getMfaStatus(options?: RequestContextOptions): Promise<ApiResult<MfaStatusResponseDto>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/mfa/status'), options);
      return unwrapEnvelope<MfaStatusResponseDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Retrieve OpenID Connect / RFC 7517 JSON Web Key Set (JWKS)
   */
  async getJwks(options?: RequestContextOptions): Promise<ApiResult<JwksResponseDto>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/.well-known/jwks.json'), options);
      return unwrapEnvelope<JwksResponseDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Retrieve SPKI PEM-encoded RSA public key for token verification
   */
  async getPublicKey(options?: RequestContextOptions): Promise<ApiResult<PublicKeyResponseDto>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/public-key'), options);
      return unwrapEnvelope<PublicKeyResponseDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Get current authenticated user profile
   */
  async getMe(options?: RequestContextOptions): Promise<ApiResult<IamUserDto>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/me'), options);
      return unwrapEnvelope<IamUserDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Retrieve IAM security audit logs (Admin/Auditor only)
   */
  async getAuditLogs(
    params?: { limit?: number; offset?: number },
    options?: RequestContextOptions
  ): Promise<ApiResult<IamAuditLogDto[]>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/audit-logs'), {
        ...options,
        params: params as Record<string, string | number | boolean | undefined>,
      });
      return unwrapEnvelope<IamAuditLogDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * List database-configured MFA protected routes (Admin only)
   */
  async listProtectedRoutes(
    options?: RequestContextOptions
  ): Promise<ApiResult<MfaProtectedRouteDto[]>> {
    try {
      const res = await apiClient.get<unknown>(iamPath('/mfa/protected-routes'), options);
      return unwrapEnvelope<MfaProtectedRouteDto[]>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Add a new MFA protected route rule (Admin only)
   */
  async addProtectedRoute(
    payload: { pattern: string; method: string; description?: string },
    options?: RequestContextOptions
  ): Promise<ApiResult<MfaProtectedRouteDto>> {
    try {
      const res = await apiClient.post<unknown>(iamPath('/mfa/protected-routes'), payload, options);
      return unwrapEnvelope<MfaProtectedRouteDto>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },

  /**
   * Delete an MFA protected route rule (Admin only)
   */
  async deleteProtectedRoute(
    id: string,
    options?: RequestContextOptions
  ): Promise<ApiResult<{ deleted: boolean }>> {
    try {
      const res = await apiClient.delete<unknown>(
        iamPath(`/mfa/protected-routes/${encodeURIComponent(id)}`),
        options
      );
      return unwrapEnvelope<{ deleted: boolean }>(res.data, res.status);
    } catch (err) {
      throw extractApiServiceError(err);
    }
  },
};
