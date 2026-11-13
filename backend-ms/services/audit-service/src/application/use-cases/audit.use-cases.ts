import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { IAuditRepository, AuditQueryFilter } from '../../domain/repositories/audit-repository.interface.js';
import { AuditLog, AuditSeverity } from '../../domain/entities/audit-log.entity.js';
import { monitoringManager } from '../../infrastructure/monitoring/monitoring.manager.js';

export interface RecordAuditInput {
  tenantId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  severity?: AuditSeverity;
  details?: Record<string, any>;
  ipAddress?: string;
  correlationId?: string;
}

export interface AuditDto {
  id: string;
  tenantId?: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  severity: string;
  details?: Record<string, any>;
  ipAddress?: string;
  correlationId?: string;
  createdAt: string;
}

export class RecordAuditLogUseCase implements UseCase<RecordAuditInput, AuditDto> {
  constructor(private readonly repo: IAuditRepository) {}

  async execute(input: RecordAuditInput): Promise<Result<AuditDto>> {
    const log = AuditLog.create({
      tenantId: input.tenantId || 'default',
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      severity: input.severity || 'INFO',
      details: input.details,
      ipAddress: input.ipAddress,
      correlationId: input.correlationId
    });

    try {
      await this.repo.save(log);
    } finally {
      // Broadcast across enabled monitoring adapters (CloudWatch, Prometheus, Grafana)
      // even if DB persistence fails (e.g., under DDoS saturation or temporary DB outage)
      await monitoringManager.broadcastAuditLog(log);
    }

    return Result.ok({
      id: log.id,
      tenantId: log.tenantId,
      actorId: log.actorId,
      actorEmail: log.actorEmail,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      severity: log.severity,
      details: log.details,
      ipAddress: log.ipAddress,
      correlationId: log.correlationId,
      createdAt: log.createdAt.toISOString()
    });
  }
}

export class QueryAuditLogsQuery implements UseCase<AuditQueryFilter, AuditDto[]> {
  constructor(private readonly repo: IAuditRepository) {}

  async execute(filter: AuditQueryFilter): Promise<Result<AuditDto[]>> {
    const logs = await this.repo.query(filter);
    return Result.ok(
      logs.map(log => ({
        id: log.id,
        tenantId: log.tenantId,
        actorId: log.actorId,
        actorEmail: log.actorEmail,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        severity: log.severity,
        details: log.details,
        ipAddress: log.ipAddress,
        correlationId: log.correlationId,
        createdAt: log.createdAt.toISOString()
      }))
    );
  }
}
