import { Entity } from '../../shared/domain/entity.js';
import { TenantConfigDto } from '../../shared/contracts/index.js';

export type TenantConfig = TenantConfigDto;

export const DEFAULT_TENANT_CONFIG: TenantConfig = {
  allowLocalLogin: true,
  allowFederatedLogin: true,
  autoProvisionUsers: true,
  defaultRole: 'USER',
  allowedEmailDomains: [],
  sessionTtlSeconds: 3600
};

export interface TenantProps {
  slug: string;
  name: string;
  isActive: boolean;
  config: TenantConfig;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Tenant extends Entity<TenantProps> {
  private constructor(props: TenantProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: {
      slug: string;
      name: string;
      isActive?: boolean;
      config?: Partial<TenantConfig>;
    },
    id?: string
  ): Tenant {
    return new Tenant(
      {
        slug: props.slug.trim().toLowerCase(),
        name: props.name.trim(),
        isActive: props.isActive ?? true,
        config: {
          ...DEFAULT_TENANT_CONFIG,
          ...(props.config || {})
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: TenantProps, id: string): Tenant {
    return new Tenant(
      {
        ...props,
        config: {
          ...DEFAULT_TENANT_CONFIG,
          ...(props.config || {})
        }
      },
      id
    );
  }

  get slug(): string { return this.props.slug; }
  get name(): string { return this.props.name; }
  get isActive(): boolean { return this.props.isActive; }
  get config(): TenantConfig { return this.props.config; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public updateSettings(patch: {
    name?: string;
    isActive?: boolean;
    config?: Partial<TenantConfig>;
  }): void {
    if (patch.name !== undefined) {
      this.props.name = patch.name.trim();
    }
    if (patch.isActive !== undefined) {
      this.props.isActive = patch.isActive;
    }
    if (patch.config) {
      this.props.config = {
        ...this.props.config,
        ...patch.config
      };
    }
    this.props.updatedAt = new Date();
  }

  public isEmailDomainAllowed(email: string): boolean {
    const allowed = this.props.config.allowedEmailDomains || [];
    if (allowed.length === 0) return true;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return allowed.map((d) => d.toLowerCase()).includes(domain);
  }
}

