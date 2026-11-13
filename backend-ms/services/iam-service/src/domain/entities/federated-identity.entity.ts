import { Entity } from '../../shared/domain/entity.js';

export interface FederatedIdentityProps {
  tenantId: string;
  userId: string;
  providerId: string;
  providerSlug: string;
  subject: string;
  email?: string;
  profile: Record<string, any>;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class FederatedIdentity extends Entity<FederatedIdentityProps> {
  private constructor(props: FederatedIdentityProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<FederatedIdentityProps, 'createdAt' | 'updatedAt' | 'profile'> & {
      profile?: Record<string, any>;
    },
    id?: string
  ): FederatedIdentity {
    const now = new Date();
    return new FederatedIdentity(
      {
        ...props,
        profile: props.profile || {},
        lastLoginAt: props.lastLoginAt || now,
        createdAt: now,
        updatedAt: now
      },
      id
    );
  }

  public static reconstitute(props: FederatedIdentityProps, id: string): FederatedIdentity {
    return new FederatedIdentity(props, id);
  }

  get tenantId(): string { return this.props.tenantId; }
  get userId(): string { return this.props.userId; }
  get providerId(): string { return this.props.providerId; }
  get providerSlug(): string { return this.props.providerSlug; }
  get subject(): string { return this.props.subject; }
  get email(): string | undefined { return this.props.email; }
  get profile(): Record<string, any> { return this.props.profile; }
  get lastLoginAt(): Date | undefined { return this.props.lastLoginAt; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public recordLogin(email?: string, profile?: Record<string, any>): void {
    const now = new Date();
    if (email) this.props.email = email;
    if (profile) this.props.profile = profile;
    this.props.lastLoginAt = now;
    this.props.updatedAt = now;
  }
}

