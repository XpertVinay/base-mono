import { ValueObject } from '../../shared/domain/value-object.js';
import { ValidationError } from '../../shared/domain/errors.js';
import bcrypt from 'bcryptjs';

export interface PasswordProps {
  hashedValue: string;
}

export class PasswordVO extends ValueObject<PasswordProps> {
  private constructor(props: PasswordProps) {
    super(props);
  }

  public static async create(plainText: string): Promise<PasswordVO> {
    if (!plainText || plainText.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(plainText, salt);
    return new PasswordVO({ hashedValue: hashed });
  }

  public static fromHash(hash: string): PasswordVO {
    return new PasswordVO({ hashedValue: hash });
  }

  get value(): string {
    return this.props.hashedValue;
  }

  public async compare(plainText: string): Promise<boolean> {
    return bcrypt.compare(plainText, this.props.hashedValue);
  }
}
