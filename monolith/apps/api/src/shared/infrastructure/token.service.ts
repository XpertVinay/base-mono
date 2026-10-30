import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { securityConfig } from '../../config/security.js';
import { UserRole } from '@monolith/contracts';
import { UnauthorizedError } from '../presentation/error-handler.middleware.js';

export interface ClientContext {
  userAgent?: string;
  ip?: string;
  deviceFingerprint?: string;
  tenantId?: string;
}

export interface AccessTokenClaims {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  fgp: string;
  tokenType: 'access';
  iat: number;
  exp: number;
  mfaVerified?: boolean;
  mfaVerifiedAt?: number;
}

export interface RefreshTokenClaims {
  id: string;
  role: UserRole;
  tenantId?: string;
  fgp: string;
  jti: string;
  tokenType: 'refresh';
  iat: number;
  exp: number;
  mfaVerified?: boolean;
  mfaVerifiedAt?: number;
}

export interface MfaChallengeClaims {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  fgp: string;
  tokenType: 'mfa_challenge';
  iat: number;
  exp: number;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
}

export interface UserTokenProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
}

export interface ITokenService {
  generateTokens(
    user: UserTokenProfile,
    context?: ClientContext,
    mfaVerified?: boolean,
    mfaVerifiedAt?: number
  ): GeneratedTokens;
  generateAsymmetricAccessToken(
    user: UserTokenProfile,
    context?: ClientContext,
    mfaVerified?: boolean,
    mfaVerifiedAt?: number
  ): string;
  verifyAccessToken(
    token: string,
    context?: ClientContext
  ): { id: string; email: string; role: UserRole; tenantId?: string; mfaVerified?: boolean; mfaVerifiedAt?: number };
  verifyAsymmetricToken(
    token: string,
    context?: ClientContext
  ): { id: string; email: string; role: UserRole; tenantId?: string; mfaVerified?: boolean; mfaVerifiedAt?: number };
  verifyRefreshToken(
    token: string,
    context?: ClientContext
  ): { id: string; role: UserRole; tenantId?: string; jti: string; mfaVerified?: boolean; mfaVerifiedAt?: number };
  generateMfaChallengeToken(user: UserTokenProfile, context?: ClientContext, ttlMs?: number): string;
  verifyMfaChallengeToken(token: string, context?: ClientContext): { id: string; email: string; role: UserRole; tenantId?: string };
  generateFingerprint(context?: ClientContext): string;
  getJwks(): { keys: Array<{ kty: string; use: string; alg: string; kid: string; n: string; e: string }> };
  getPublicKeyPem(): string;
}

export class TokenService implements ITokenService {
  private readonly accessKey: Buffer;
  private readonly refreshKey: Buffer;
  private readonly challengeKey: Buffer;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;
  private readonly challengeTtlMs: number;

  // Asymmetric Cryptography (RS256 / JWKS)
  private readonly rsaPrivateKey: string;
  private readonly rsaPublicKey: string;
  private readonly keyId: string = 'monolith-iam-key-1';

  constructor() {
    this.accessKey = crypto.createHash('sha256').update(securityConfig.jwt.secret).digest();
    this.refreshKey = crypto.createHash('sha256').update(securityConfig.jwt.refreshSecret).digest();
    this.challengeKey = crypto.createHash('sha256').update(`${securityConfig.jwt.secret}::mfa-challenge`).digest();
    this.accessTtlMs = this.parseDurationToMs(securityConfig.jwt.expiresIn, 3600 * 1000); // 1h default
    this.refreshTtlMs = this.parseDurationToMs(securityConfig.jwt.refreshExpiresIn, 7 * 86400 * 1000); // 7d default
    this.challengeTtlMs = 5 * 60 * 1000; // 5m default for MFA challenge

    // Initialize Asymmetric RSA Key Pair (Environment override or secure 2048-bit key generation)
    if (process.env.IAM_JWT_PRIVATE_KEY && process.env.IAM_JWT_PUBLIC_KEY) {
      this.rsaPrivateKey = process.env.IAM_JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
      this.rsaPublicKey = process.env.IAM_JWT_PUBLIC_KEY.replace(/\\n/g, '\n');
    } else {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      this.rsaPublicKey = publicKey;
      this.rsaPrivateKey = privateKey;
    }
  }

  public generateFingerprint(context?: ClientContext): string {
    const ua = (context?.userAgent || 'generic-client').trim().toLowerCase();
    const deviceHint = (context?.deviceFingerprint || '').trim();
    return crypto
      .createHmac('sha256', securityConfig.jwt.secret)
      .update(`${ua}::${deviceHint}`)
      .digest('hex');
  }

  public generateTokens(
    user: UserTokenProfile,
    context?: ClientContext,
    mfaVerified?: boolean,
    mfaVerifiedAt?: number
  ): GeneratedTokens {
    const now = Date.now();
    const fgp = this.generateFingerprint(context);
    const tenantId = user.tenantId || context?.tenantId;

    // 1. Encrypted Access Token (AES-256-GCM) with Tenant and Fingerprint Binding
    const accessClaims: AccessTokenClaims = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId,
      fgp,
      tokenType: 'access',
      iat: now,
      exp: now + this.accessTtlMs,
      mfaVerified: mfaVerified ?? false,
      mfaVerifiedAt: mfaVerified ? (mfaVerifiedAt || now) : undefined
    };
    const accessToken = this.encryptPayload('enc', this.accessKey, accessClaims);

    // 2. Encrypted Refresh Token (AES-256-GCM)
    const refreshClaims: RefreshTokenClaims = {
      id: user.id,
      role: user.role,
      tenantId,
      fgp,
      jti: uuidv4(),
      tokenType: 'refresh',
      iat: now,
      exp: now + this.refreshTtlMs,
      mfaVerified: mfaVerified ?? false,
      mfaVerifiedAt: mfaVerified ? (mfaVerifiedAt || now) : undefined
    };
    const refreshToken = this.encryptPayload('ref', this.refreshKey, refreshClaims);

    // 3. OpenID Connect (OIDC) Signed ID Token using Asymmetric RS256
    const idToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: tenantId,
        mfa_verified: mfaVerified ?? false,
        iss: 'monolith-iam',
        aud: 'monolith-client'
      },
      this.rsaPrivateKey,
      {
        algorithm: 'RS256',
        keyid: this.keyId,
        expiresIn: securityConfig.jwt.expiresIn as any
      }
    );

    return {
      accessToken,
      refreshToken,
      idToken
    };
  }

  /**
   * Generates a fully Asymmetric (RS256) Access Token for multi-tenant / microservice consumption.
   * Enables third-party services and microfrontends to verify authenticity using JWKS without symmetric secrets.
   */
  public generateAsymmetricAccessToken(
    user: UserTokenProfile,
    context?: ClientContext,
    mfaVerified?: boolean,
    mfaVerifiedAt?: number
  ): string {
    const now = Date.now();
    const fgp = this.generateFingerprint(context);
    const tenantId = user.tenantId || context?.tenantId;

    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tenant_id: tenantId,
        token_type: 'access',
        fgp,
        mfa_verified: mfaVerified ?? false,
        mfa_verified_at: mfaVerified ? (mfaVerifiedAt || now) : undefined,
        iss: 'monolith-iam',
        aud: 'monolith-client'
      },
      this.rsaPrivateKey,
      {
        algorithm: 'RS256',
        keyid: this.keyId,
        expiresIn: securityConfig.jwt.expiresIn as any
      }
    );
  }

  public verifyAsymmetricToken(
    token: string,
    context?: ClientContext
  ): { id: string; email: string; role: UserRole; tenantId?: string; mfaVerified?: boolean; mfaVerifiedAt?: number } {
    let decoded: any;
    try {
      decoded = jwt.verify(token, this.rsaPublicKey, { algorithms: ['RS256'] });
    } catch {
      throw new UnauthorizedError('Invalid or expired asymmetric token signature');
    }

    // Verify anti-hijacking device fingerprint if present
    if (decoded.fgp) {
      const currentFgp = this.generateFingerprint(context);
      if (decoded.fgp !== currentFgp) {
        throw new UnauthorizedError(
          'Session hijacking detected: Asymmetric token cannot be used from a different device, client, or browser session'
        );
      }
    }

    return {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role,
      tenantId: decoded.tenant_id || decoded.tenantId,
      mfaVerified: decoded.mfa_verified ?? decoded.mfaVerified ?? false,
      mfaVerifiedAt: decoded.mfa_verified_at ?? decoded.mfaVerifiedAt
    };
  }

  public generateMfaChallengeToken(user: UserTokenProfile, context?: ClientContext, ttlMs?: number): string {
    const now = Date.now();
    const fgp = this.generateFingerprint(context);
    const challengeClaims: MfaChallengeClaims = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || context?.tenantId,
      fgp,
      tokenType: 'mfa_challenge',
      iat: now,
      exp: now + (ttlMs || this.challengeTtlMs)
    };
    return this.encryptPayload('mfa', this.challengeKey, challengeClaims);
  }

  public verifyMfaChallengeToken(token: string, context?: ClientContext): { id: string; email: string; role: UserRole; tenantId?: string } {
    let claims: MfaChallengeClaims;
    try {
      claims = this.decryptPayload('mfa', this.challengeKey, token);
    } catch {
      throw new UnauthorizedError('Invalid or malformed MFA challenge token');
    }

    if (claims.tokenType !== 'mfa_challenge') {
      throw new UnauthorizedError('Invalid token type: expected MFA challenge token');
    }

    if (Date.now() > claims.exp) {
      throw new UnauthorizedError('MFA challenge token has expired. Please log in again.');
    }

    const currentFgp = this.generateFingerprint(context);
    if (claims.fgp !== currentFgp) {
      throw new UnauthorizedError(
        'Session hijacking detected: MFA challenge cannot be verified from a different device or browser session'
      );
    }

    return {
      id: claims.id,
      email: claims.email,
      role: claims.role,
      tenantId: claims.tenantId
    };
  }

  public verifyAccessToken(
    token: string,
    context?: ClientContext
  ): { id: string; email: string; role: UserRole; tenantId?: string; mfaVerified?: boolean; mfaVerifiedAt?: number } {
    let claims: AccessTokenClaims;
    try {
      claims = this.decryptPayload('enc', this.accessKey, token);
    } catch {
      throw new UnauthorizedError('Invalid or malformed authentication token');
    }

    if (claims.tokenType !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }

    if (Date.now() > claims.exp) {
      throw new UnauthorizedError('Authentication token has expired');
    }

    // Verify Client Fingerprint to prevent cross-browser / cross-device session hijacking
    const currentFgp = this.generateFingerprint(context);
    if (claims.fgp !== currentFgp) {
      throw new UnauthorizedError(
        'Session hijacking detected: Token cannot be used from a different device, client, or browser session'
      );
    }

    return {
      id: claims.id,
      email: claims.email,
      role: claims.role,
      tenantId: claims.tenantId,
      mfaVerified: claims.mfaVerified,
      mfaVerifiedAt: claims.mfaVerifiedAt
    };
  }

  public verifyRefreshToken(
    token: string,
    context?: ClientContext
  ): { id: string; role: UserRole; tenantId?: string; jti: string; mfaVerified?: boolean; mfaVerifiedAt?: number } {
    let claims: RefreshTokenClaims;
    try {
      claims = this.decryptPayload('ref', this.refreshKey, token);
    } catch {
      throw new UnauthorizedError('Invalid or malformed refresh token');
    }

    if (claims.tokenType !== 'refresh') {
      throw new UnauthorizedError('Invalid token type: expected refresh token');
    }

    if (Date.now() > claims.exp) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const currentFgp = this.generateFingerprint(context);
    if (claims.fgp !== currentFgp) {
      throw new UnauthorizedError(
        'Session hijacking detected: Refresh token cannot be used from a different device or browser session'
      );
    }

    return {
      id: claims.id,
      role: claims.role,
      tenantId: claims.tenantId,
      jti: claims.jti,
      mfaVerified: claims.mfaVerified,
      mfaVerifiedAt: claims.mfaVerifiedAt
    };
  }

  /**
   * Returns RFC 7517 JSON Web Key Set (JWKS) for decentralized public key verification.
   */
  public getJwks(): { keys: Array<{ kty: string; use: string; alg: string; kid: string; n: string; e: string }> } {
    const keyObject = crypto.createPublicKey(this.rsaPublicKey);
    const jwk = keyObject.export({ format: 'jwk' }) as any;
    return {
      keys: [
        {
          kty: jwk.kty || 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: this.keyId,
          n: jwk.n || '',
          e: jwk.e || 'AQAB'
        }
      ]
    };
  }

  /**
   * Returns RSA Public Key in PEM format.
   */
  public getPublicKeyPem(): string {
    return this.rsaPublicKey;
  }

  private encryptPayload(prefix: string, key: Buffer, payload: any): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const jsonStr = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${prefix}.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decryptPayload<T>(prefix: string, key: Buffer, token: string): T {
    const parts = token.split('.');
    if (parts.length !== 4 || parts[0] !== prefix) {
      throw new Error('Invalid token structure');
    }
    const [, ivStr, authTagStr, ciphertextStr] = parts;
    if (!ivStr || !authTagStr || !ciphertextStr) {
      throw new Error('Malformed token component');
    }
    const iv = Buffer.from(ivStr, 'base64url');
    const authTag = Buffer.from(authTagStr, 'base64url');
    const ciphertext = Buffer.from(ciphertextStr, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  private parseDurationToMs(duration: string, defaultMs: number): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match || !match[1] || !match[2]) return defaultMs;
    const val = parseInt(match[1], 10);
    switch (match[2]) {
      case 's': return val * 1000;
      case 'm': return val * 60 * 1000;
      case 'h': return val * 3600 * 1000;
      case 'd': return val * 86400 * 1000;
      default: return defaultMs;
    }
  }
}

export const tokenService = new TokenService();
