import { ValueObject } from '../../../../shared/domain/value-object.js';

interface PasswordProps {
  value: string;
}

export class Password extends ValueObject<PasswordProps> {
  private constructor(props: PasswordProps) {
    super(props);
  }

  get value(): string {
    return this.props.value;
  }

  public static create(password: string): Password {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    return new Password({ value: password });
  }

  public static fromHashed(hashedPassword: string): Password {
    return new Password({ value: hashedPassword });
  }
}
