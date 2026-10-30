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
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
  mfaBackupCodes?: string[];
  mfaEnrolledAt?: Date | null;
  mfaLastVerifiedAt?: Date | null;
  ssoProvider?: string | null;
  ssoSubjectId?: string | null;
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

  get tenantId(): string | null {
    return this.props.tenantId ?? null;
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

  get mfaEnabled(): boolean {
    return this.props.mfaEnabled ?? false;
  }

  get mfaSecret(): string | null {
    return this.props.mfaSecret ?? null;
  }

  get mfaBackupCodes(): string[] {
    return this.props.mfaBackupCodes ?? [];
  }

  get mfaEnrolledAt(): Date | null {
    return this.props.mfaEnrolledAt ?? null;
  }

  get mfaLastVerifiedAt(): Date | null {
    return this.props.mfaLastVerifiedAt ?? null;
  }

  get ssoProvider(): string | null {
    return this.props.ssoProvider ?? null;
  }

  get ssoSubjectId(): string | null {
    return this.props.ssoSubjectId ?? null;
  }

  public enableMfa(secret: string, backupCodes: string[]): void {
    const now = new Date();
    this.props.mfaEnabled = true;
    this.props.mfaSecret = secret;
    this.props.mfaBackupCodes = backupCodes;
    this.props.mfaEnrolledAt = now;
    this.props.mfaLastVerifiedAt = now;
    this.props.updatedAt = now;
  }

  public disableMfa(): void {
    this.props.mfaEnabled = false;
    this.props.mfaSecret = null;
    this.props.mfaBackupCodes = [];
    this.props.mfaEnrolledAt = null;
    this.props.mfaLastVerifiedAt = null;
    this.props.updatedAt = new Date();
  }

  public recordMfaVerification(): void {
    const now = new Date();
    this.props.mfaLastVerifiedAt = now;
    this.props.updatedAt = now;
  }

  public consumeBackupCode(codeHash: string): boolean {
    const codes = this.props.mfaBackupCodes || [];
    const index = codes.indexOf(codeHash);
    if (index === -1) {
      return false;
    }
    codes.splice(index, 1);
    this.props.mfaBackupCodes = codes;
    this.recordMfaVerification();
    return true;
  }

  public setSso(provider: string, subjectId: string): void {
    this.props.ssoProvider = provider;
    this.props.ssoSubjectId = subjectId;
    this.props.updatedAt = new Date();
  }

  public isMfaSessionValid(maxAgeMs: number = 24 * 3600 * 1000): boolean {
    if (!this.props.mfaEnabled) return true;
    if (!this.props.mfaLastVerifiedAt) return false;
    return Date.now() - this.props.mfaLastVerifiedAt.getTime() <= maxAgeMs;
  }

  public static create(
    email: string,
    password: Password,
    name: string,
    role: UserRole = 'USER',
    id?: string,
    ssoProvider?: string | null,
    ssoSubjectId?: string | null,
    tenantId?: string | null
  ): User {
    const userId = id || uuidv4();
    const now = new Date();

    const user = new User(userId, {
      email: email.toLowerCase().trim(),
      password,
      name,
      role,
      isActive: true,
      tenantId: tenantId || null,
      createdAt: now,
      updatedAt: now,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      mfaEnrolledAt: null,
      mfaLastVerifiedAt: null,
      ssoProvider: ssoProvider || null,
      ssoSubjectId: ssoSubjectId || null
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
