import { Entity } from '../../shared/domain/entity.js';
import {
  FederationProtocol,
  OidcProviderType,
  ProviderApprovalStatus,
  ProviderConfigSource
} from '../../shared/contracts/index.js';

export interface ClaimMapping {
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  groups?: string;
  emailVerified?: string;
  [key: string]: string | undefined;
}

export interface SamlProviderConfig {
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpSloUrl?: string;
  spEntityId?: string;
  idpCertificatePem?: string;
  nameIdFormat?: string;
  signAuthnRequest?: boolean;
}

export const DEFAULT_CLAIM_MAPPING: Required<Pick<ClaimMapping, 'sub' | 'email' | 'name' | 'role' | 'groups' | 'emailVerified'>> = {
  sub: 'sub',
  email: 'email',
  name: 'name',
  role: 'role',
  groups: 'groups',
  emailVerified: 'email_verified'
};

export function inferFederationProtocol(providerType: OidcProviderType): FederationProtocol {
  if (providerType === 'SAML') return 'SAML';
  if (providerType === 'GENERIC_OAUTH2') return 'OAUTH2';
  return 'OIDC';
}

export interface OidcProviderProps {
  tenantId: string;
  slug: string;
  providerType: OidcProviderType;
  protocol: FederationProtocol;
  displayName: string;
  issuerUrl: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  endSessionEndpoint?: string;
  clientId: string;
  clientSecretEncrypted?: string;
  redirectUri: string;
  allowedRedirectUris: string[];
  scopes: string;
  usePkce: boolean;
  autoProvision: boolean;
  allowedDomains: string[];
  claimMapping: Record<string, string>;
  roleMapping: Record<string, string>;
  extraAuthParams: Record<string, string>;
  samlConfig?: SamlProviderConfig;
  isSystemDefault: boolean;
  inheritsSystemConfig: boolean;
  parentProviderId?: string;
  approvalStatus: ProviderApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  isEnabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class OidcProvider extends Entity<OidcProviderProps> {
  private constructor(props: OidcProviderProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<
      OidcProviderProps,
      | 'createdAt'
      | 'updatedAt'
      | 'protocol'
      | 'allowedRedirectUris'
      | 'scopes'
      | 'usePkce'
      | 'autoProvision'
      | 'allowedDomains'
      | 'claimMapping'
      | 'roleMapping'
      | 'extraAuthParams'
      | 'isSystemDefault'
      | 'inheritsSystemConfig'
      | 'approvalStatus'
      | 'isEnabled'
    > &
      Partial<
        Pick<
          OidcProviderProps,
          | 'protocol'
          | 'allowedRedirectUris'
          | 'scopes'
          | 'usePkce'
          | 'autoProvision'
          | 'allowedDomains'
          | 'claimMapping'
          | 'roleMapping'
          | 'extraAuthParams'
          | 'isSystemDefault'
          | 'inheritsSystemConfig'
          | 'approvalStatus'
          | 'isEnabled'
        >
      >,
    id?: string
  ): OidcProvider {
    const protocol = props.protocol || inferFederationProtocol(props.providerType);
    return new OidcProvider(
      {
        ...props,
        slug: props.slug.trim().toLowerCase(),
        protocol,
        issuerUrl: props.issuerUrl.replace(/\/+$/, ''),
        allowedRedirectUris: props.allowedRedirectUris || [],
        scopes: props.scopes || (protocol === 'OAUTH2' ? 'read:user user:email' : 'openid profile email'),
        usePkce: props.usePkce ?? protocol !== 'SAML',
        autoProvision: props.autoProvision ?? true,
        allowedDomains: props.allowedDomains || [],
        claimMapping: {
          ...DEFAULT_CLAIM_MAPPING,
          ...(props.claimMapping || {})
        },
        roleMapping: props.roleMapping || {},
        extraAuthParams: props.extraAuthParams || {},
        samlConfig: props.samlConfig || undefined,
        isSystemDefault: props.isSystemDefault ?? false,
        inheritsSystemConfig: props.inheritsSystemConfig ?? false,
        approvalStatus: props.approvalStatus || 'APPROVED',
        isEnabled: props.isEnabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      id
    );
  }

  public static reconstitute(
    props: Omit<
      OidcProviderProps,
      'protocol' | 'allowedRedirectUris' | 'isSystemDefault' | 'inheritsSystemConfig' | 'approvalStatus'
    > &
      Partial<
        Pick<
          OidcProviderProps,
          'protocol' | 'allowedRedirectUris' | 'isSystemDefault' | 'inheritsSystemConfig' | 'approvalStatus'
        >
      >,
    id: string
  ): OidcProvider {
    return new OidcProvider(
      {
        ...props,
        protocol: props.protocol || inferFederationProtocol(props.providerType),
        allowedRedirectUris: props.allowedRedirectUris || [],
        claimMapping: {
          ...DEFAULT_CLAIM_MAPPING,
          ...(props.claimMapping || {})
        },
        allowedDomains: props.allowedDomains || [],
        roleMapping: props.roleMapping || {},
        extraAuthParams: props.extraAuthParams || {},
        samlConfig: props.samlConfig || undefined,
        isSystemDefault: props.isSystemDefault ?? false,
        inheritsSystemConfig: props.inheritsSystemConfig ?? false,
        approvalStatus: props.approvalStatus || 'APPROVED'
      },
      id
    );
  }

  get tenantId(): string { return this.props.tenantId; }
  get slug(): string { return this.props.slug; }
  get providerType(): OidcProviderType { return this.props.providerType; }
  get protocol(): FederationProtocol { return this.props.protocol; }
  get displayName(): string { return this.props.displayName; }
  get issuerUrl(): string { return this.props.issuerUrl; }
  get authorizationEndpoint(): string | undefined { return this.props.authorizationEndpoint; }
  get tokenEndpoint(): string | undefined { return this.props.tokenEndpoint; }
  get userinfoEndpoint(): string | undefined { return this.props.userinfoEndpoint; }
  get jwksUri(): string | undefined { return this.props.jwksUri; }
  get endSessionEndpoint(): string | undefined { return this.props.endSessionEndpoint; }
  get clientId(): string { return this.props.clientId; }
  get clientSecretEncrypted(): string | undefined { return this.props.clientSecretEncrypted; }
  get redirectUri(): string { return this.props.redirectUri; }
  get allowedRedirectUris(): string[] { return this.props.allowedRedirectUris; }
  get scopes(): string { return this.props.scopes; }
  get usePkce(): boolean { return this.props.usePkce; }
  get autoProvision(): boolean { return this.props.autoProvision; }
  get allowedDomains(): string[] { return this.props.allowedDomains; }
  get claimMapping(): Record<string, string> { return this.props.claimMapping; }
  get roleMapping(): Record<string, string> { return this.props.roleMapping; }
  get extraAuthParams(): Record<string, string> { return this.props.extraAuthParams; }
  get samlConfig(): SamlProviderConfig | undefined { return this.props.samlConfig; }
  get isSystemDefault(): boolean { return this.props.isSystemDefault; }
  get inheritsSystemConfig(): boolean { return this.props.inheritsSystemConfig; }
  get parentProviderId(): string | undefined { return this.props.parentProviderId; }
  get approvalStatus(): ProviderApprovalStatus { return this.props.approvalStatus; }
  get approvedBy(): string | undefined { return this.props.approvedBy; }
  get approvedAt(): Date | undefined { return this.props.approvedAt; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }
  get isEnabled(): boolean { return this.props.isEnabled; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public update(patch: Partial<Omit<OidcProviderProps, 'tenantId' | 'createdAt' | 'updatedAt'>>): void {
    Object.assign(this.props, {
      ...patch,
      ...(patch.slug ? { slug: patch.slug.trim().toLowerCase() } : {}),
      ...(patch.issuerUrl ? { issuerUrl: patch.issuerUrl.replace(/\/+$/, '') } : {}),
      ...(patch.claimMapping
        ? { claimMapping: { ...this.props.claimMapping, ...patch.claimMapping } }
        : {}),
      ...(patch.samlConfig
        ? { samlConfig: { ...(this.props.samlConfig || {}), ...patch.samlConfig } }
        : {})
    });
    this.props.updatedAt = new Date();
  }

  public approve(adminUserId: string): void {
    this.props.approvalStatus = 'APPROVED';
    this.props.approvedBy = adminUserId;
    this.props.approvedAt = new Date();
    this.props.rejectionReason = undefined;
    this.props.updatedAt = new Date();
  }

  public reject(adminUserId: string, reason?: string): void {
    this.props.approvalStatus = 'REJECTED';
    this.props.approvedBy = adminUserId;
    this.props.approvedAt = new Date();
    this.props.rejectionReason = reason || 'Rejected by platform administrator';
    this.props.updatedAt = new Date();
  }

  public markPendingApproval(): void {
    this.props.approvalStatus = 'PENDING';
    this.props.approvedBy = undefined;
    this.props.approvedAt = undefined;
    this.props.rejectionReason = undefined;
    this.props.updatedAt = new Date();
  }

  public isActiveForAuth(): boolean {
    return this.props.isEnabled && this.props.approvalStatus === 'APPROVED';
  }

  public getConfigSource(): ProviderConfigSource {
    if (this.props.isSystemDefault) return 'SYSTEM_DEFAULT';
    if (this.props.parentProviderId || this.props.inheritsSystemConfig) return 'TENANT_OVERRIDE';
    return 'TENANT_CUSTOM';
  }

  /**
   * Produces an effective provider view for a tenant by inheriting missing fields
   * from the system-default provider when `inheritsSystemConfig` is enabled.
   */
  public resolveEffectiveWithSystem(systemProvider: OidcProvider): OidcProvider {
    const mergedSaml: SamlProviderConfig | undefined =
      this.props.samlConfig || systemProvider.samlConfig
        ? { ...(systemProvider.samlConfig || {}), ...(this.props.samlConfig || {}) }
        : undefined;

    return OidcProvider.reconstitute(
      {
        tenantId: this.props.tenantId,
        slug: this.props.slug,
        providerType: this.props.providerType || systemProvider.providerType,
        protocol: this.props.protocol || systemProvider.protocol,
        displayName: this.props.displayName || systemProvider.displayName,
        issuerUrl: this.props.issuerUrl || systemProvider.issuerUrl,
        authorizationEndpoint: this.props.authorizationEndpoint || systemProvider.authorizationEndpoint,
        tokenEndpoint: this.props.tokenEndpoint || systemProvider.tokenEndpoint,
        userinfoEndpoint: this.props.userinfoEndpoint || systemProvider.userinfoEndpoint,
        jwksUri: this.props.jwksUri || systemProvider.jwksUri,
        endSessionEndpoint: this.props.endSessionEndpoint || systemProvider.endSessionEndpoint,
        clientId: this.props.clientId || systemProvider.clientId,
        clientSecretEncrypted: this.props.clientSecretEncrypted || systemProvider.clientSecretEncrypted,
        redirectUri: this.props.redirectUri || systemProvider.redirectUri,
        allowedRedirectUris:
          this.props.allowedRedirectUris.length > 0
            ? this.props.allowedRedirectUris
            : systemProvider.allowedRedirectUris,
        scopes: this.props.scopes || systemProvider.scopes,
        usePkce: this.props.usePkce ?? systemProvider.usePkce,
        autoProvision: this.props.autoProvision ?? systemProvider.autoProvision,
        allowedDomains:
          this.props.allowedDomains.length > 0
            ? this.props.allowedDomains
            : systemProvider.allowedDomains,
        claimMapping: { ...systemProvider.claimMapping, ...this.props.claimMapping },
        roleMapping: { ...systemProvider.roleMapping, ...this.props.roleMapping },
        extraAuthParams: { ...systemProvider.extraAuthParams, ...this.props.extraAuthParams },
        samlConfig: mergedSaml,
        isSystemDefault: false,
        inheritsSystemConfig: this.props.inheritsSystemConfig,
        parentProviderId: this.props.parentProviderId || systemProvider.id,
        approvalStatus: this.props.approvalStatus,
        approvedBy: this.props.approvedBy,
        approvedAt: this.props.approvedAt,
        rejectionReason: this.props.rejectionReason,
        isEnabled: this.props.isEnabled,
        createdAt: this.props.createdAt,
        updatedAt: this.props.updatedAt
      },
      this.id
    );
  }

  /**
   * Projects a system-default provider as inherited for a specific tenant.
   */
  public asInheritedForTenant(tenantId: string): OidcProvider {
    return OidcProvider.reconstitute(
      {
        tenantId,
        slug: this.props.slug,
        providerType: this.props.providerType,
        protocol: this.props.protocol,
        displayName: this.props.displayName,
        issuerUrl: this.props.issuerUrl,
        authorizationEndpoint: this.props.authorizationEndpoint,
        tokenEndpoint: this.props.tokenEndpoint,
        userinfoEndpoint: this.props.userinfoEndpoint,
        jwksUri: this.props.jwksUri,
        endSessionEndpoint: this.props.endSessionEndpoint,
        clientId: this.props.clientId,
        clientSecretEncrypted: this.props.clientSecretEncrypted,
        redirectUri: this.props.redirectUri,
        allowedRedirectUris: this.props.allowedRedirectUris,
        scopes: this.props.scopes,
        usePkce: this.props.usePkce,
        autoProvision: this.props.autoProvision,
        allowedDomains: this.props.allowedDomains,
        claimMapping: this.props.claimMapping,
        roleMapping: this.props.roleMapping,
        extraAuthParams: this.props.extraAuthParams,
        samlConfig: this.props.samlConfig,
        isSystemDefault: true,
        inheritsSystemConfig: true,
        parentProviderId: this.id,
        approvalStatus: this.props.approvalStatus,
        approvedBy: this.props.approvedBy,
        approvedAt: this.props.approvedAt,
        isEnabled: this.props.isEnabled,
        createdAt: this.props.createdAt,
        updatedAt: this.props.updatedAt
      },
      this.id
    );
  }

  public isRedirectUriAllowed(uri: string): boolean {
    const normalize = (u: string) => u.trim().replace(/\/+$/, '');
    const target = normalize(uri);
    const allowed = [this.props.redirectUri, ...(this.props.allowedRedirectUris || [])]
      .filter(Boolean)
      .map(normalize);
    return allowed.includes(target);
  }

  public isEmailDomainAllowed(email: string): boolean {
    if (!this.props.allowedDomains || this.props.allowedDomains.length === 0) {
      return true;
    }
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.props.allowedDomains.map((d) => d.toLowerCase()).includes(domain);
  }

  public resolveRole(
    externalRoles: string[],
    fallbackRole: 'USER' | 'ADMIN' | 'SUPPORT' = 'USER'
  ): 'USER' | 'ADMIN' | 'SUPPORT' {
    const validRoles = new Set(['USER', 'ADMIN', 'SUPPORT']);
    for (const extRole of externalRoles) {
      const mapped = this.props.roleMapping[extRole] || this.props.roleMapping[extRole.toLowerCase()];
      if (mapped && validRoles.has(mapped.toUpperCase())) {
        return mapped.toUpperCase() as 'USER' | 'ADMIN' | 'SUPPORT';
      }
      if (validRoles.has(extRole.toUpperCase())) {
        return extRole.toUpperCase() as 'USER' | 'ADMIN' | 'SUPPORT';
      }
    }
    return fallbackRole;
  }
}
