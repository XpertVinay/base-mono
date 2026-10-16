import { Entity } from '../../shared/domain/entity.js';

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface AuditLogProps {
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  severity: AuditSeverity;
  details?: Record<string, any>;
  ipAddress?: string;
  correlationId?: string;
  createdAt: Date;
}

export class AuditLog extends Entity<AuditLogProps> {
  private constructor(props: AuditLogProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<AuditLogProps, 'createdAt'>,
    id?: string
  ): AuditLog {
    return new AuditLog(
      {
        ...props,
        createdAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: AuditLogProps, id: string): AuditLog {
    return new AuditLog(props, id);
  }

  get actorId(): string | undefined { return this.props.actorId; }
  get actorEmail(): string | undefined { return this.props.actorEmail; }
  get action(): string { return this.props.action; }
  get resource(): string { return this.props.resource; }
  get resourceId(): string | undefined { return this.props.resourceId; }
  get severity(): AuditSeverity { return this.props.severity; }
  get details(): Record<string, any> | undefined { return this.props.details; }
  get ipAddress(): string | undefined { return this.props.ipAddress; }
  get correlationId(): string | undefined { return this.props.correlationId; }
  get createdAt(): Date { return this.props.createdAt; }
}
