import { AggregateRoot } from '../../shared/domain/aggregate-root.js';
import { ValidationError } from '../../shared/domain/errors.js';
import {
  McpAuthType,
  McpHealthStatus,
  McpProviderCategory,
  McpProviderDto,
  McpTransportType
} from '../../shared/contracts/index.js';

export interface McpProviderProps {
  tenantId: string;
  slug: string;
  name: string;
  category: McpProviderCategory;
  transportType: McpTransportType;
  endpointUrl?: string;
  command?: string;
  args: string[];
  authType: McpAuthType;
  credentialsEncrypted?: string;
  config: Record<string, any>;
  capabilities: Record<string, any>;
  isBuiltin: boolean;
  isEnabled: boolean;
  healthStatus: McpHealthStatus;
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,98}$/;

export class McpProvider extends AggregateRoot<McpProviderProps> {
  private constructor(props: McpProviderProps, id?: string) {
    super(props, id);
  }

  public static create(
    input: {
      tenantId?: string;
      slug: string;
      name: string;
      category: McpProviderCategory;
      transportType: McpTransportType;
      endpointUrl?: string;
      command?: string;
      args?: string[];
      authType?: McpAuthType;
      credentialsEncrypted?: string;
      config?: Record<string, any>;
      capabilities?: Record<string, any>;
      isBuiltin?: boolean;
      isEnabled?: boolean;
      healthStatus?: McpHealthStatus;
    },
    id?: string
  ): McpProvider {
    const slug = input.slug.trim().toLowerCase();
    if (!VALID_SLUG_RE.test(slug)) {
      throw new ValidationError(
        `Invalid provider slug '${input.slug}'. Must be 2-99 lowercase alphanumeric, dot, underscore, or hyphen characters.`
      );
    }

    if (
      (input.transportType === 'STREAMABLE_HTTP' ||
        input.transportType === 'SSE' ||
        input.transportType === 'REST_API') &&
      !input.endpointUrl &&
      !input.isBuiltin
    ) {
      throw new ValidationError(`Provider '${slug}' with transport '${input.transportType}' requires an endpointUrl`);
    }

    if (input.transportType === 'STDIO' && !input.command) {
      throw new ValidationError(`Provider '${slug}' with transport 'STDIO' requires a command`);
    }

    const now = new Date();
    return new McpProvider(
      {
        tenantId: input.tenantId || 'default',
        slug,
        name: input.name.trim(),
        category: input.category,
        transportType: input.transportType,
        endpointUrl: input.endpointUrl?.trim() || undefined,
        command: input.command?.trim() || undefined,
        args: input.args || [],
        authType: input.authType || 'NONE',
        credentialsEncrypted: input.credentialsEncrypted,
        config: input.config || {},
        capabilities: input.capabilities || {},
        isBuiltin: Boolean(input.isBuiltin),
        isEnabled: input.isEnabled ?? true,
        healthStatus: input.healthStatus || 'UNKNOWN',
        createdAt: now,
        updatedAt: now
      },
      id
    );
  }

  public static reconstitute(props: McpProviderProps, id: string): McpProvider {
    return new McpProvider(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get slug(): string {
    return this.props.slug;
  }
  get name(): string {
    return this.props.name;
  }
  get category(): McpProviderCategory {
    return this.props.category;
  }
  get transportType(): McpTransportType {
    return this.props.transportType;
  }
  get endpointUrl(): string | undefined {
    return this.props.endpointUrl;
  }
  get command(): string | undefined {
    return this.props.command;
  }
  get args(): string[] {
    return this.props.args;
  }
  get authType(): McpAuthType {
    return this.props.authType;
  }
  get credentialsEncrypted(): string | undefined {
    return this.props.credentialsEncrypted;
  }
  get config(): Record<string, any> {
    return this.props.config;
  }
  get capabilities(): Record<string, any> {
    return this.props.capabilities;
  }
  get isBuiltin(): boolean {
    return this.props.isBuiltin;
  }
  get isEnabled(): boolean {
    return this.props.isEnabled;
  }
  get healthStatus(): McpHealthStatus {
    return this.props.healthStatus;
  }
  get lastSyncedAt(): Date | undefined {
    return this.props.lastSyncedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public update(patch: {
    name?: string;
    endpointUrl?: string;
    command?: string;
    args?: string[];
    authType?: McpAuthType;
    credentialsEncrypted?: string;
    config?: Record<string, any>;
    isEnabled?: boolean;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name.trim();
    if (patch.endpointUrl !== undefined) this.props.endpointUrl = patch.endpointUrl.trim() || undefined;
    if (patch.command !== undefined) this.props.command = patch.command.trim() || undefined;
    if (patch.args !== undefined) this.props.args = patch.args;
    if (patch.authType !== undefined) this.props.authType = patch.authType;
    if (patch.credentialsEncrypted !== undefined) this.props.credentialsEncrypted = patch.credentialsEncrypted;
    if (patch.config !== undefined) this.props.config = patch.config;
    if (patch.isEnabled !== undefined) this.props.isEnabled = patch.isEnabled;
    this.props.updatedAt = new Date();
  }

  public markSynced(capabilities?: Record<string, any>): void {
    if (capabilities) {
      this.props.capabilities = capabilities;
    }
    this.props.healthStatus = 'HEALTHY';
    this.props.lastSyncedAt = new Date();
    this.props.updatedAt = new Date();
  }

  public updateHealth(status: McpHealthStatus): void {
    this.props.healthStatus = status;
    this.props.updatedAt = new Date();
  }

  public toDto(): McpProviderDto {
    return {
      id: this._id,
      tenantId: this.props.tenantId,
      slug: this.props.slug,
      name: this.props.name,
      category: this.props.category,
      transportType: this.props.transportType,
      endpointUrl: this.props.endpointUrl,
      command: this.props.command,
      args: this.props.args,
      authType: this.props.authType,
      hasCredentials: Boolean(this.props.credentialsEncrypted),
      config: this.props.config,
      capabilities: this.props.capabilities,
      isBuiltin: this.props.isBuiltin,
      isEnabled: this.props.isEnabled,
      healthStatus: this.props.healthStatus,
      lastSyncedAt: this.props.lastSyncedAt?.toISOString(),
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}

