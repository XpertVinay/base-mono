import { RabbitMQService, DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { RecordAuditLogUseCase } from '../../application/use-cases/audit.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

/**
 * SRP: Encapsulates subscription and recording of domain events into the immutable audit trail.
 */
export class AuditEventRecorder {
  private readonly queueName = 'audit-service-event-recorder';
  private readonly routingKeys = [
    'iam.*',
    'orders.*',
    'transactions.*',
    'assets.*',
    'config.*',
    'audit.*'
  ];

  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly recordUseCase: RecordAuditLogUseCase
  ) {}

  public async start(): Promise<void> {
    await this.rabbitmq.subscribe(this.queueName, this.routingKeys, async (event: DomainIntegrationEvent) => {
      logger.info(`[AuditEventRecorder] Recording immutable audit trail for event: ${event.eventName}`, {
        eventId: event.id,
        aggregateId: event.aggregateId
      });

      const payload = event.payload as any;
      await this.recordUseCase.execute({
        actorId: payload?.userId || payload?.actorId || undefined,
        actorEmail: payload?.email || undefined,
        action: event.eventName,
        resource: event.eventName.split('.')[0] || 'SYSTEM',
        resourceId: event.aggregateId,
        severity: event.eventName.includes('failed') ? 'WARN' : 'INFO',
        details: payload,
        correlationId: event.id
      });
    });
  }
}
