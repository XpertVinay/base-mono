import { IIntegrationEventHandler } from './event-handler.interface.js';
import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { SendNotificationUseCase } from '../../application/use-cases/notification.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface TransactionCompletedPayload {
  transactionId: string;
  referenceId: string;
  userId?: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * SRP: Dedicated handler solely responsible for payment transaction notifications.
 */
export class TransactionCompletedNotificationHandler implements IIntegrationEventHandler<TransactionCompletedPayload> {
  readonly eventName = 'transactions.transaction_completed';
  readonly queueName = 'notification-service-transaction-completed';

  constructor(private readonly sendNotificationUseCase: SendNotificationUseCase) {}

  async handle(event: DomainIntegrationEvent<TransactionCompletedPayload>): Promise<void> {
    const payload = event.payload;
    if (payload?.status !== 'SUCCESS') {
      logger.debug(`[TransactionCompletedNotificationHandler] Skipping non-success transaction: ${payload?.status}`);
      return;
    }

    logger.info(`[TransactionCompletedNotificationHandler] Processing payment receipt for ${payload.referenceId}`, {
      eventId: event.id,
      aggregateId: event.aggregateId
    });

    const recipient = `user-${payload.userId || 'customer'}@platform.local`;

    await this.sendNotificationUseCase.execute({
      recipient,
      channel: 'EMAIL',
      subject: `Payment Succeeded for ${payload.referenceId}`,
      body: `Your transaction of ${payload.currency || 'USD'} ${payload.amount} was completed successfully.`
    });
  }
}
