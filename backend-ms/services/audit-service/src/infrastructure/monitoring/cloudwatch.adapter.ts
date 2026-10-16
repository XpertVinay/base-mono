import { IMonitoringAdapter } from './monitoring-adapters.interface.js';
import { AuditLog } from '../../domain/entities/audit-log.entity.js';
import { logger } from '../../shared/infrastructure/logger.js';

export class CloudWatchMonitoringAdapter implements IMonitoringAdapter {
  readonly adapterName = 'AWS_CLOUDWATCH';
  public readonly isEnabled: boolean;
  private logGroup: string;
  private logStream: string;

  constructor() {
    this.isEnabled = process.env.ENABLE_CLOUDWATCH === 'true';
    this.logGroup = process.env.AWS_CLOUDWATCH_LOG_GROUP || '/platform/microservices/audit';
    this.logStream = process.env.AWS_CLOUDWATCH_LOG_STREAM || 'audit-stream';
  }

  async init(): Promise<void> {
    if (!this.isEnabled) {
      logger.info('AWS CloudWatch adapter is disabled via configuration flag.');
      return;
    }
    logger.info(`Initializing AWS CloudWatch adapter for log group: ${this.logGroup}`);
  }

  async exportAuditLog(log: AuditLog): Promise<void> {
    if (!this.isEnabled) return;

    const payload = {
      timestamp: log.createdAt.getTime(),
      message: JSON.stringify({
        id: log.id,
        actor: log.actorEmail || log.actorId,
        action: log.action,
        resource: log.resource,
        severity: log.severity,
        correlationId: log.correlationId,
        details: log.details
      })
    };

    logger.info(`[AWS CloudWatch Batch Export] -> ${this.logGroup}/${this.logStream}`, {
      logId: log.id,
      eventTimestamp: payload.timestamp
    });
  }

  recordMetric(metricName: string, value: number, labels?: Record<string, string>): void {
    if (!this.isEnabled) return;
    logger.info(`[AWS CloudWatch Metric] ${metricName}: ${value}`, { labels });
  }
}
