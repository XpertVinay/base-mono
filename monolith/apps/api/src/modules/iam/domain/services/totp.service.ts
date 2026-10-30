import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  public static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
      const b = buffer[i] ?? 0;
      value = (value << 8) | b;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_CHARS[(value << (5 - bits)) & 31];
    }
    return output;
  }

  public static base32Decode(input: string): Buffer {
    const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i] ?? '';
      const idx = BASE32_CHARS.indexOf(char);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  public static generateSecret(lengthBytes: number = 20): string {
    const randomBytes = crypto.randomBytes(lengthBytes);
    return this.base32Encode(randomBytes);
  }

  public static generateTotp(secretBase32: string, timeMs: number = Date.now(), stepSec: number = 30): string {
    const secret = this.base32Decode(secretBase32);
    const counter = Math.floor(timeMs / 1000 / stepSec);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
    const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
    const b0 = hmac[offset] ?? 0;
    const b1 = hmac[offset + 1] ?? 0;
    const b2 = hmac[offset + 2] ?? 0;
    const b3 = hmac[offset + 3] ?? 0;
    const binary =
      ((b0 & 0x7f) << 24) |
      ((b1 & 0xff) << 16) |
      ((b2 & 0xff) << 8) |
      (b3 & 0xff);
    return (binary % 1000000).toString().padStart(6, '0');
  }

  public static verifyTotp(
    token: string,
    secretBase32: string,
    window: number = 1,
    timeMs: number = Date.now(),
    stepSec: number = 30
  ): boolean {
    const normalizedToken = token.trim();
    if (!/^\d{6}$/.test(normalizedToken)) {
      return false;
    }

    const currentCounter = Math.floor(timeMs / 1000 / stepSec);
    for (let i = -window; i <= window; i++) {
      const testTime = (currentCounter + i) * stepSec * 1000;
      if (this.generateTotp(secretBase32, testTime, stepSec) === normalizedToken) {
        return true;
      }
    }
    return false;
  }

  public static generateOtpauthUrl(email: string, secretBase32: string, issuer: string = 'Monolith'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  public static hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  public static generateBackupCodes(count: number = 8): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters e.g. "A1B2C3D4"
      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      plainCodes.push(formatted);
      hashedCodes.push(this.hashBackupCode(formatted));
    }

    return { plainCodes, hashedCodes };
  }

  public static verifyBackupCode(code: string, hashedCodes: string[]): boolean {
    const hashed = this.hashBackupCode(code);
    return hashedCodes.includes(hashed);
  }
}
