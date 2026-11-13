import { Entity } from '../../shared/domain/entity.js';
import { PasswordVO } from '../value-objects/password.vo.js';

export type AuthMethod = 'LOCAL' | 'OIDC' | 'HYBRID';

export type UserRole =
  | 'USER'
  | 'ADMIN'
  | 'SUPPORT'
  | 'OWNER'
  | 'CARETAKER'
  | 'TENANT'
  | 'BUYER'
  | 'VENDOR'
  | 'AGENT'
  | 'LEGAL'
  | 'AUDITOR'
  | string;

export interface UserProps {
  tenantId: string;
  email: string;
  passwordHash?: PasswordVO;
  name: string;
  role: UserRole;
  authMethod: AuthMethod;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User extends Entity<UserProps> {
  private constructor(props: UserProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<UserProps, 'isActive' | 'tenantId' | 'authMethod'> & {
      tenantId?: string;
      authMethod?: AuthMethod;
    },
    id?: string
  ): User {
    return new User(
      {
        ...props,
        tenantId: props.tenantId || process.env.DEFAULT_TENANT_ID || 'default',
        email: props.email.trim().toLowerCase(),
        authMethod: props.authMethod || (props.passwordHash ? 'LOCAL' : 'OIDC'),
        isActive: true,
        createdAt: props.createdAt || new Date(),
        updatedAt: props.updatedAt || new Date()
      },
      id
    );
  }

  public static reconstitute(props: UserProps, id: string): User {
    return new User(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        authMethod: props.authMethod || (props.passwordHash ? 'LOCAL' : 'OIDC')
      },
      id
    );
  }

  get tenantId(): string { return this.props.tenantId; }
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get role(): UserRole { return this.props.role; }
  get passwordHash(): PasswordVO | undefined { return this.props.passwordHash; }
  get authMethod(): AuthMethod { return this.props.authMethod; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public canAuthenticateLocally(): boolean {
    return Boolean(this.props.passwordHash);
  }

  public markFederatedLinked(): void {
    if (this.props.authMethod === 'LOCAL' && this.props.passwordHash) {
      this.props.authMethod = 'HYBRID';
    }
    this.props.updatedAt = new Date();
  }

  public updateProfileFromFederation(name?: string): void {
    if (name && name.trim().length >= 2) {
      this.props.name = name.trim();
    }
    this.props.updatedAt = new Date();
  }

  public updateProfile(props: { name?: string; email?: string; role?: UserRole }): void {
    if (props.name && props.name.trim().length >= 2) {
      this.props.name = props.name.trim();
    }
    if (props.email && props.email.trim().length >= 5) {
      this.props.email = props.email.trim().toLowerCase();
    }
    if (props.role && props.role.trim().length > 0) {
      this.props.role = props.role.trim().toUpperCase();
    }
    this.props.updatedAt = new Date();
  }

  public changePassword(newPasswordHash: PasswordVO): void {
    this.props.passwordHash = newPasswordHash;
    if (this.props.authMethod === 'OIDC') {
      this.props.authMethod = 'HYBRID';
    }
    this.props.updatedAt = new Date();
  }

  public setAuthMethod(authMethod: AuthMethod): void {
    this.props.authMethod = authMethod;
    this.props.updatedAt = new Date();
  }

  public activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  public deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }
}
