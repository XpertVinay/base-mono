import bcrypt from 'bcryptjs';
import { securityConfig } from '../../config/security.js';

export interface ICryptoService {
  hashPassword(password: string): Promise<string>;
  comparePassword(plain: string, hashed: string): Promise<boolean>;
}

export class CryptoService implements ICryptoService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, securityConfig.bcrypt.saltRounds);
  }

  async comparePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}

export const cryptoService = new CryptoService();
