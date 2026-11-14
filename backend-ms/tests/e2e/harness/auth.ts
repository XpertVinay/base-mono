/**
 * tests/e2e/harness/auth.ts
 * Cryptographic Token Generation, Asymmetric RS256 / HS256, JWKS, and Anti-Hijacking Fingerprints
 */

import { createRequire } from 'module';
import path from 'path';
import crypto from 'crypto';
import { E2E_CONFIG } from './config.js';

// Resolve jsonwebtoken from api-gateway
const require = createRequire(path.resolve('services/api-gateway/package.json'));
const jwt = require('jsonwebtoken');

export interface TokenClaims {
  sub: string;
  id?: string;
  email?: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'SUPPORT' | 'BACKOFFICE_ADMIN' | 'ORGANIZATION_ADMIN' | 'USER' | 'GUEST';
  tenantId?: string;
  tenantSlug?: string;
  sessionId?: string;
  fgp?: string; // device fingerprint binding
  iat?: number;
  exp?: number;
  [key: string]: any;
}

export interface AuthBundle {
  token: string;
  claims: TokenClaims;
  headers: Record<string, string>;
}

export interface AuthHeaderOptions {
  tenantSlug?: string;
  deviceFingerprint?: string;
  sessionId?: string;
}

export class AuthHelper {
  public static jwt = jwt;
  private static rsaKeys?: { publicKey: string; privateKey: string };

  /**
   * Generates or returns cached RS256 key pair for JWKS
   */
  static getRsaKeyPair(): { publicKey: string; privateKey: string } {
    if (!this.rsaKeys) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      this.rsaKeys = { publicKey, privateKey };
    }
    return this.rsaKeys;
  }

  /**
   * Generates a signed JWT token using the configured secret or RS256 private key.
   */
  static signToken(
    claims: TokenClaims,
    options: {
      algorithm?: string;
      expiresIn?: string | number;
      keyId?: string;
    } = {}
  ): string {
    const algorithm = (options.algorithm || 'HS256') as any;
    const expiresIn = options.expiresIn || '1h';

    if (algorithm === 'RS256') {
      const { privateKey } = this.getRsaKeyPair();
      return jwt.sign(claims, privateKey, {
        algorithm: 'RS256',
        expiresIn,
        keyid: options.keyId || 'key-rs256-1'
      });
    }

    return jwt.sign(claims, E2E_CONFIG.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn
    });
  }

  /**
   * Admin Role Auth (System Wide)
   */
  static admin(tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id, opts: AuthHeaderOptions = {}): AuthBundle {
    const claims: TokenClaims = {
      sub: 'usr-admin-system',
      id: 'usr-admin-system',
      email: 'admin@platform.system',
      role: 'ADMIN',
      tenantId,
      tenantSlug: opts.tenantSlug || 'alpha'
    };
    const token = this.signToken(claims);
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId,
        ...(opts.deviceFingerprint ? { [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: opts.deviceFingerprint } : {})
      }
    };
  }

  /**
   * Standard User Auth
   */
  static user(
    userId: string = 'usr-client-1',
    tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id,
    opts: AuthHeaderOptions = {}
  ): AuthBundle {
    const claims: TokenClaims = {
      sub: userId,
      id: userId,
      email: `${userId}@alpha.io`,
      role: 'USER',
      tenantId,
      tenantSlug: opts.tenantSlug || 'alpha'
    };
    const token = this.signToken(claims);
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId,
        ...(opts.deviceFingerprint ? { [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: opts.deviceFingerprint } : {})
      }
    };
  }

  /**
   * Back-Office Support/Admin Auth (For /api/v1/backoffice/*)
   */
  static backoffice(
    role: 'ADMIN' | 'SUPPORT' | 'BACKOFFICE_ADMIN' | 'ORGANIZATION_ADMIN' = 'SUPPORT',
    tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id,
    opts: AuthHeaderOptions = {}
  ): AuthBundle {
    const claims: TokenClaims = {
      sub: 'usr-support-1',
      id: 'usr-support-1',
      email: 'support@backoffice.platform',
      role,
      tenantId,
      tenantSlug: opts.tenantSlug || 'alpha'
    };
    const token = this.signToken(claims);
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId,
        ...(opts.deviceFingerprint ? { [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: opts.deviceFingerprint } : {})
      }
    };
  }

  /**
   * Organization Admin Auth
   */
  static orgAdmin(tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id, opts: AuthHeaderOptions = {}): AuthBundle {
    const claims: TokenClaims = {
      sub: 'usr-orgadmin-1',
      id: 'usr-orgadmin-1',
      email: 'orgadmin@alpha.io',
      role: 'ORGANIZATION_ADMIN',
      tenantId,
      tenantSlug: opts.tenantSlug || 'alpha'
    };
    const token = this.signToken(claims);
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId,
        ...(opts.deviceFingerprint ? { [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: opts.deviceFingerprint } : {})
      }
    };
  }

  /**
   * Device Fingerprint Bound Auth (For Anti-Hijacking F20)
   */
  static withFingerprint(
    fingerprint: string,
    role: 'ADMIN' | 'USER' = 'USER',
    tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id
  ): AuthBundle {
    const claims: TokenClaims = {
      sub: 'usr-fgp-1',
      id: 'usr-fgp-1',
      email: 'device-user@alpha.io',
      role,
      tenantId,
      fgp: fingerprint
    };
    const token = this.signToken(claims);
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId,
        [E2E_CONFIG.HEADERS.DEVICE_FINGERPRINT]: fingerprint
      }
    };
  }

  static withDeviceFingerprint(
    fingerprint: string,
    role: 'ADMIN' | 'USER' = 'USER',
    tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id
  ): AuthBundle {
    return this.withFingerprint(fingerprint, role, tenantId);
  }

  /**
   * Expired Token (For boundary authentication tests)
   */
  static expired(tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id): AuthBundle {
    const claims: TokenClaims = {
      sub: 'usr-expired',
      id: 'usr-expired',
      email: 'expired@alpha.io',
      role: 'USER',
      tenantId
    };
    const token = this.signToken(claims, { expiresIn: '-10s' });
    return {
      token,
      claims,
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId
      }
    };
  }

  /**
   * Tampered / Invalid Signature Token
   */
  static tampered(tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id): AuthBundle {
    const validToken = this.signToken({ sub: 'usr-tampered', id: 'usr-tampered', role: 'USER', tenantId });
    const parts = validToken.split('.');
    const tamperedSig = parts[2] ? parts[2].slice(0, -4) + 'AAAA' : 'invalidsig';
    const token = `${parts[0]}.${parts[1]}.${tamperedSig}`;
    return {
      token,
      claims: { sub: 'usr-tampered', tenantId },
      headers: {
        authorization: `Bearer ${token}`,
        [E2E_CONFIG.HEADERS.TENANT]: tenantId
      }
    };
  }

  /**
   * Internal Machine-to-Machine Service Headers (Saga, inter-service)
   */
  static internalService(tenantId: string = E2E_CONFIG.TENANTS.ALPHA.id): Record<string, string> {
    const adminToken = this.admin(tenantId).token;
    return {
      authorization: `Bearer ${adminToken}`,
      [E2E_CONFIG.HEADERS.INTERNAL_SECRET]: E2E_CONFIG.INTERNAL_SERVICE_SECRET,
      [E2E_CONFIG.HEADERS.USER_ID]: 'system-saga',
      [E2E_CONFIG.HEADERS.USER_ROLE]: 'ADMIN',
      [E2E_CONFIG.HEADERS.TENANT]: tenantId
    };
  }
}
