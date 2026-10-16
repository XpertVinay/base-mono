import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { Password } from '../value-objects/password.vo.js';
import { UserRole } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface UserProps {
  email: string;
  password: Password;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserProps> {
  private constructor(id: string, props: UserProps) {
    super(id, props);
  }

  get email(): string {
    return this.props.email;
  }

  get password(): Password {
    return this.props.password;
  }

  get name(): string {
    return this.props.name;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public static create(
    email: string,
    password: Password,
    name: string,
    role: UserRole = 'USER',
    id?: string
  ): User {
    const userId = id || uuidv4();
    const now = new Date();

    const user = new User(userId, {
      email: email.toLowerCase().trim(),
      password,
      name,
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    user.addDomainEvent({
      id: uuidv4(),
      eventName: 'iam.user_registered',
      aggregateId: userId,
      occurredAt: now,
      version: 1,
      payload: {
        userId,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

    return user;
  }

  public static reconstitute(id: string, props: UserProps): User {
    return new User(id, props);
  }
}
