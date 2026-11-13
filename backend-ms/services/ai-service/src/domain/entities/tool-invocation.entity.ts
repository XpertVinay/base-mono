import { Entity } from '../../shared/domain/entity.js';
import { ToolInvocationDto } from '../../shared/contracts/index.js';

export interface ToolInvocationProps {
  tenantId: string;
  actorId?: string;
  providerId?: string;
  providerSlug: string;
  toolName: string;
  category: string;
  status: 'SUCCESS' | 'ERROR';
  argumentsRedacted: Record<string, any>;
  resultSummary?: Record<string, any>;
  errorMessage?: string;
  durationMs: number;
  correlationId?: string;
  createdAt: Date;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'connectionstring',
  'connection_string',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
  'bearer'
]);

export function redactSensitiveArgs(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveArgs);
  if (typeof obj !== 'object') return obj;

  const redacted: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      redacted[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      redacted[k] = redactSensitiveArgs(v);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export class ToolInvocationLog extends Entity<ToolInvocationProps> {
  private constructor(props: ToolInvocationProps, id?: string) {
    super(props, id);
  }

  public static create(
    input: {
      tenantId?: string;
      actorId?: string;
      providerId?: string;
      providerSlug: string;
      toolName: string;
      category: string;
      status: 'SUCCESS' | 'ERROR';
      arguments?: Record<string, any>;
      resultSummary?: Record<string, any>;
      errorMessage?: string;
      durationMs: number;
      correlationId?: string;
    },
    id?: string
  ): ToolInvocationLog {
    return new ToolInvocationLog(
      {
        tenantId: input.tenantId || 'default',
        actorId: input.actorId,
        providerId: input.providerId,
        providerSlug: input.providerSlug,
        toolName: input.toolName,
        category: input.category,
        status: input.status,
        argumentsRedacted: redactSensitiveArgs(input.arguments || {}),
        resultSummary: input.resultSummary,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs,
        correlationId: input.correlationId,
        createdAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: ToolInvocationProps, id: string): ToolInvocationLog {
    return new ToolInvocationLog(props, id);
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get actorId(): string | undefined {
    return this.props.actorId;
  }
  get providerId(): string | undefined {
    return this.props.providerId;
  }
  get providerSlug(): string {
    return this.props.providerSlug;
  }
  get toolName(): string {
    return this.props.toolName;
  }
  get category(): string {
    return this.props.category;
  }
  get status(): 'SUCCESS' | 'ERROR' {
    return this.props.status;
  }
  get argumentsRedacted(): Record<string, any> {
    return this.props.argumentsRedacted;
  }
  get resultSummary(): Record<string, any> | undefined {
    return this.props.resultSummary;
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }
  get durationMs(): number {
    return this.props.durationMs;
  }
  get correlationId(): string | undefined {
    return this.props.correlationId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  public toDto(): ToolInvocationDto {
    return {
      id: this._id,
      tenantId: this.props.tenantId,
      actorId: this.props.actorId,
      providerId: this.props.providerId,
      providerSlug: this.props.providerSlug,
      toolName: this.props.toolName,
      category: this.props.category,
      status: this.props.status,
      argumentsRedacted: this.props.argumentsRedacted,
      resultSummary: this.props.resultSummary,
      errorMessage: this.props.errorMessage,
      durationMs: this.props.durationMs,
      correlationId: this.props.correlationId,
      createdAt: this.props.createdAt.toISOString()
    };
  }
}

