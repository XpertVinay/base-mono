import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { IOrderRepository } from '../../domain/repositories/order-repository.interface.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface TransactionCompletedPayload {
  transactionId: string;
  referenceId: string;
  status: string;
  amount: number;
}

export interface IIntegrationEventHandler<T = any> {
  readonly eventName: string;
  readonly queueName: string;
  handle(event: DomainIntegrationEvent<T>): Promise<void>;
}

/**
 * SRP: Dedicated handler solely responsible for marking orders PAID upon transaction success.
 */
export class TransactionCompletedOrderHandler implements IIntegrationEventHandler<TransactionCompletedPayload> {
  readonly eventName = 'transactions.transaction_completed';
  readonly queueName = 'order-service-transactions';

  constructor(private readonly repo: IOrderRepository) {}

  async handle(event: DomainIntegrationEvent<TransactionCompletedPayload>): Promise<void> {
    const payload = event.payload;
    if (payload?.status !== 'SUCCESS' || !payload.referenceId) {
      return;
    }

    logger.info(`[TransactionCompletedOrderHandler] Updating order ${payload.referenceId} to PAID`);
    const order = await this.repo.findById(payload.referenceId);
    if (order) {
      order.markPaid();
      await this.repo.update(order);
      logger.info(`[TransactionCompletedOrderHandler] Order ${order.id} marked as PAID via RabbitMQ event`);
    } else {
      logger.warn(`[TransactionCompletedOrderHandler] Order ${payload.referenceId} not found`);
    }
  }
}
