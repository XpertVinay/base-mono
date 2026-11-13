import { Entity } from '../../shared/domain/entity.js';
import { McpToolDto } from '../../shared/contracts/index.js';

export interface McpToolProps {
  tenantId: string;
  providerId: string;
  providerSlug: string;
  toolName: string;
  qualifiedName: string;
  description?: string;
  inputSchema: Record<string, any>;
  annotations: Record<string, any>;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class McpToolDefinition extends Entity<McpToolProps> {
  private constructor(props: McpToolProps, id?: string) {
    super(props, id);
  }

  public static create(
    input: {
      tenantId?: string;
      providerId: string;
      providerSlug: string;
      toolName: string;
      description?: string;
      inputSchema?: Record<string, any>;
      annotations?: Record<string, any>;
      isEnabled?: boolean;
    },
    id?: string
  ): McpToolDefinition {
    const now = new Date();
    const qualifiedName = `${input.providerSlug}.${input.toolName}`;
    return new McpToolDefinition(
      {
        tenantId: input.tenantId || 'default',
        providerId: input.providerId,
        providerSlug: input.providerSlug,
        toolName: input.toolName,
        qualifiedName,
        description: input.description,
        inputSchema: input.inputSchema || { type: 'object', properties: {} },
        annotations: input.annotations || {},
        isEnabled: input.isEnabled ?? true,
        createdAt: now,
        updatedAt: now
      },
      id
    );
  }

  public static reconstitute(props: McpToolProps, id: string): McpToolDefinition {
    return new McpToolDefinition(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get providerId(): string {
    return this.props.providerId;
  }
  get providerSlug(): string {
    return this.props.providerSlug;
  }
  get toolName(): string {
    return this.props.toolName;
  }
  get qualifiedName(): string {
    return this.props.qualifiedName;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get inputSchema(): Record<string, any> {
    return this.props.inputSchema;
  }
  get annotations(): Record<string, any> {
    return this.props.annotations;
  }
  get isEnabled(): boolean {
    return this.props.isEnabled;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public toDto(): McpToolDto {
    return {
      id: this._id,
      tenantId: this.props.tenantId,
      providerId: this.props.providerId,
      providerSlug: this.props.providerSlug,
      toolName: this.props.toolName,
      qualifiedName: this.props.qualifiedName,
      description: this.props.description,
      inputSchema: this.props.inputSchema,
      annotations: this.props.annotations,
      isEnabled: this.props.isEnabled,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}

