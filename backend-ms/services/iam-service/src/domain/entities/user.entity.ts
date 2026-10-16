import { Entity } from '../../shared/domain/entity.js';
import { PasswordVO } from '../value-objects/password.vo.js';

export interface UserProps {
  email: string;
  passwordHash: PasswordVO;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPPORT';
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) {
    super(props, id);
  }

  public static create(props: Omit<UserProps, 'isActive'>, id?: string): User {
    return new User(
      {
        ...props,
        isActive: true,
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      id
    );
  }

  public static reconstitute(props: UserProps, id: string): User {
    return new User(props, id);
  }

  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get role(): string { return this.props.role; }
  get passwordHash(): PasswordVO { return this.props.passwordHash; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }
}
