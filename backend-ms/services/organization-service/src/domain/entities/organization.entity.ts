import { AggregateRoot } from '../../shared/domain/aggregate-root.js';
import {
  OrganizationAddress,
  OrganizationDto,
  OrganizationSettings,
  OrganizationStatus,
  OrganizationTier
} from '../../shared/contracts/index.js';

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  branding: {
    primaryColor: '#2563eb'
  },
  security: {
    enforceMfa: false,
    sessionTtlSeconds: 3600,
    allowedEmailDomains: []
  },
  features: {
    auditLogs: true,
    sso: false,
    customDomain: false
  },
  maxUsers: 50,
  timezone: 'UTC',
  currency: 'USD'
};

export interface OrganizationProps {
  slug: string;
  name: string;
  legalName?: string;
  status: OrganizationStatus;
  tier: OrganizationTier;
  industry?: string;
  taxId?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  address?: OrganizationAddress;
  settings: OrganizationSettings;
  maxUsers: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization extends AggregateRoot<OrganizationProps> {
  private constructor(props: OrganizationProps, id?: string) {
    super(props, id);
  }

  public static create(
    params: {
      name: string;
      slug: string;
      legalName?: string;
      status?: OrganizationStatus;
      tier?: OrganizationTier;
      industry?: string;
      taxId?: string;
      contactEmail: string;
      contactPhone?: string;
      website?: string;
      address?: OrganizationAddress;
      settings?: Partial<OrganizationSettings>;
      maxUsers?: number;
    },
    id?: string
  ): Organization {
    const slug = Organization.sanitizeSlug(params.slug);
    if (!slug) {
      throw new Error('Organization slug must be non-empty and contain valid URL-friendly characters.');
    }

    const email = params.contactEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('A valid contact email is required.');
    }

    const tier = params.tier || 'FREE';
    const defaultMaxUsers = tier === 'ENTERPRISE' ? 10000 : tier === 'PROFESSIONAL' ? 250 : tier === 'STARTER' ? 50 : 10;
    const maxUsers = params.maxUsers && params.maxUsers > 0 ? params.maxUsers : defaultMaxUsers;

    const mergedSettings: OrganizationSettings = {
      ...DEFAULT_ORGANIZATION_SETTINGS,
      ...(params.settings || {}),
      branding: {
        ...DEFAULT_ORGANIZATION_SETTINGS.branding,
        ...(params.settings?.branding || {})
      },
      security: {
        ...DEFAULT_ORGANIZATION_SETTINGS.security,
        ...(params.settings?.security || {})
      },
      features: {
        ...DEFAULT_ORGANIZATION_SETTINGS.features,
        ...(params.settings?.features || {})
      },
      maxUsers
    };

    return new Organization(
      {
        name: params.name.trim(),
        slug,
        legalName: params.legalName?.trim(),
        status: params.status || 'ACTIVE',
        tier,
        industry: params.industry?.trim(),
        taxId: params.taxId?.trim(),
        contactEmail: email,
        contactPhone: params.contactPhone?.trim(),
        website: params.website?.trim(),
        address: params.address,
        settings: mergedSettings,
        maxUsers,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: OrganizationProps, id: string): Organization {
    return new Organization(props, id);
  }

  public static sanitizeSlug(rawSlug: string): string {
    return rawSlug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  get slug(): string { return this.props.slug; }
  get name(): string { return this.props.name; }
  get legalName(): string | undefined { return this.props.legalName; }
  get status(): OrganizationStatus { return this.props.status; }
  get tier(): OrganizationTier { return this.props.tier; }
  get industry(): string | undefined { return this.props.industry; }
  get taxId(): string | undefined { return this.props.taxId; }
  get contactEmail(): string { return this.props.contactEmail; }
  get contactPhone(): string | undefined { return this.props.contactPhone; }
  get website(): string | undefined { return this.props.website; }
  get address(): OrganizationAddress | undefined { return this.props.address; }
  get settings(): OrganizationSettings { return this.props.settings; }
  get maxUsers(): number { return this.props.maxUsers; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public updateDetails(patch: {
    name?: string;
    legalName?: string;
    industry?: string;
    taxId?: string;
    contactEmail?: string;
    contactPhone?: string;
    website?: string;
    address?: OrganizationAddress;
    tier?: OrganizationTier;
    maxUsers?: number;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name.trim();
    if (patch.legalName !== undefined) this.props.legalName = patch.legalName.trim();
    if (patch.industry !== undefined) this.props.industry = patch.industry.trim();
    if (patch.taxId !== undefined) this.props.taxId = patch.taxId.trim();
    if (patch.contactEmail !== undefined) {
      const email = patch.contactEmail.trim().toLowerCase();
      if (!email.includes('@')) throw new Error('Invalid contact email format');
      this.props.contactEmail = email;
    }
    if (patch.contactPhone !== undefined) this.props.contactPhone = patch.contactPhone.trim();
    if (patch.website !== undefined) this.props.website = patch.website.trim();
    if (patch.address !== undefined) this.props.address = patch.address;
    if (patch.tier !== undefined) this.props.tier = patch.tier;
    if (patch.maxUsers !== undefined && patch.maxUsers > 0) this.props.maxUsers = patch.maxUsers;

    this.props.updatedAt = new Date();
  }

  public updateStatus(newStatus: OrganizationStatus): void {
    if (this.props.status === newStatus) return;
    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  public updateSettings(patch: Partial<OrganizationSettings>): void {
    this.props.settings = {
      ...this.props.settings,
      ...patch,
      branding: {
        ...this.props.settings.branding,
        ...(patch.branding || {})
      },
      security: {
        ...this.props.settings.security,
        ...(patch.security || {})
      },
      features: {
        ...this.props.settings.features,
        ...(patch.features || {})
      }
    };
    if (patch.maxUsers) {
      this.props.maxUsers = patch.maxUsers;
    }
    this.props.updatedAt = new Date();
  }

  public isEmailAllowed(email: string): boolean {
    const allowed = this.props.settings.security?.allowedEmailDomains || [];
    if (!allowed || allowed.length === 0) return true;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return allowed.map((d) => d.toLowerCase().trim()).includes(domain);
  }

  public toDto(): OrganizationDto {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      legalName: this.legalName,
      status: this.status,
      tier: this.tier,
      industry: this.industry,
      taxId: this.taxId,
      contactEmail: this.contactEmail,
      contactPhone: this.contactPhone,
      website: this.website,
      address: this.address,
      settings: this.settings,
      maxUsers: this.maxUsers,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
