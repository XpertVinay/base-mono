import crypto from 'crypto';

export class CryptoService {
  public static hash(data: string, salt: string = ''): string {
    return crypto.createHmac('sha256', salt || 'secret-salt').update(data).digest('hex');
  }

  public static randomToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  private static deriveKey(secret?: string): Buffer {
    const rawSecret =
      secret ||
      process.env.MCP_ENCRYPTION_KEY ||
      process.env.OIDC_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'dev-mcp-encryption-secret-key-32-chars';
    return crypto.createHash('sha256').update(rawSecret).digest();
  }

  public static encrypt(plainText: string, secret?: string): string {
    const key = this.deriveKey(secret);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  public static decrypt(cipherText: string, secret?: string): string {
    if (!cipherText.startsWith('v1:')) {
      return cipherText;
    }
    const parts = cipherText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload format');
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const key = this.deriveKey(secret);
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

