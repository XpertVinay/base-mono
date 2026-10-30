import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../../../../config/env.js';
import { ValidationError, UnauthorizedError } from '../../../../shared/presentation/error-handler.middleware.js';

export interface EncryptedTenantContext {
  tenantId: string;       // RFC 4122 UUID
  userId?: string;        // PII user ID (protected in transit)
  email?: string;         // PII user email (protected in transit)
  orgId?: string;         // Tenant / Org identifier
  roles?: string[];       // User roles
  issuedAt: number;       // Timestamp (ms)
  expiresAt: number;      // Expiration timestamp (ms) to prevent replay attacks
}

const uuidSchema = z.string().uuid('Tenant ID in encrypted context must be an RFC 4122 UUID');

export class PiiCryptoService {
  private readonly key: Buffer;
  private readonly defaultTtlMs = 1000 * 60 * 60 * 24; // 24 hours context TTL

  constructor(secretKey: string = env.PII_ENCRYPTION_KEY) {
    // Derive a fixed 32-byte (256-bit) key using SHA-256
    this.key = crypto.createHash('sha256').update(secretKey).digest();
  }

  /**
   * Encrypts tenant & user PII context for safe transmission on the fly (HTTP headers/queries).
   * Generates a tamper-proof AES-256-GCM token with fresh random IV and authentication tag.
   */
  public encryptPiiContext(context: Omit<EncryptedTenantContext, 'issuedAt' | 'expiresAt'> & { ttlMs?: number }): string {
    const validTenantId = uuidSchema.parse(context.tenantId);

    const now = Date.now();
    const ttl = context.ttlMs || this.defaultTtlMs;

    const payload: EncryptedTenantContext = {
      tenantId: validTenantId,
      userId: context.userId,
      email: context.email,
      orgId: context.orgId,
      roles: context.roles,
      issuedAt: now,
      expiresAt: now + ttl
    };

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const jsonStr = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  /**
   * Decrypts and verifies the encrypted tenant context received on the fly.
   * Ensures GCM authenticity, freshness (not expired), and valid RFC 4122 UUID.
   */
  public decryptPiiContext(token: string): EncryptedTenantContext {
    if (!token || typeof token !== 'string') {
      throw new ValidationError('Encrypted tenant context token is required');
    }

    const parts = token.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'v1' || !parts[1] || !parts[2] || !parts[3]) {
      throw new ValidationError('Malformed encrypted tenant context token: must follow v1.<iv>.<tag>.<data>');
    }

    try {
      const iv = Buffer.from(parts[1], 'base64url');
      const authTag = Buffer.from(parts[2], 'base64url');
      const encrypted = Buffer.from(parts[3], 'base64url');

      if (iv.length !== 12 || authTag.length !== 16) {
        throw new ValidationError('Invalid cryptographic parameters in encrypted tenant context');
      }

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      const parsed: EncryptedTenantContext = JSON.parse(decrypted);

      // Verify expiration to prevent replay attacks
      if (Date.now() > parsed.expiresAt) {
        throw new UnauthorizedError('Encrypted tenant context token has expired. Please re-authenticate.');
      }

      // Verify UUID format of decrypted tenant ID
      uuidSchema.parse(parsed.tenantId);

      return parsed;
    } catch (err: any) {
      if (err instanceof ValidationError || err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Failed to decrypt tenant context: token has been tampered with or corrupted');
    }
  }

  /**
   * Encrypts sensitive configuration value or PII for storage at rest in PostgreSQL.
   */
  public encryptAtRest(plainText: string): string {
    if (!plainText) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc:v1.${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  /**
   * Decrypts configuration value or PII stored at rest in PostgreSQL.
   * If value was not encrypted (no enc:v1 prefix), returns as-is for backwards compatibility.
   */
  public decryptAtRest(cipherText: string): string {
    if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:v1.')) {
      return cipherText;
    }

    try {
      const parts = cipherText.substring('enc:v1.'.length).split('.');
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return cipherText;

      const iv = Buffer.from(parts[0], 'base64url');
      const authTag = Buffer.from(parts[1], 'base64url');
      const encrypted = Buffer.from(parts[2], 'base64url');

      const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      return cipherText;
    }
  }
}

export const piiCryptoService = new PiiCryptoService();
