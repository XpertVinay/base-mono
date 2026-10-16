import crypto from 'crypto';

export class CryptoService {
  public static hash(data: string, salt: string = ''): string {
    return crypto.createHmac('sha256', salt || 'secret-salt').update(data).digest('hex');
  }

  public static randomToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }
}
