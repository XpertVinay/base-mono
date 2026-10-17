import { ISearchProjectionEventHandler } from './event-handler.interface.js';
import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { IndexDocumentUseCase } from '../../application/use-cases/search.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  totalAmount: number;
  currency: string;
}

/**
 * SRP: Dedicated handler solely responsible for indexing order documents into search.
 */
export class OrderCreatedSearchProjectionHandler implements ISearchProjectionEventHandler<OrderCreatedPayload> {
  readonly eventName = 'orders.order_created';
  readonly queueName = 'search-service-order-indexer';

  constructor(private readonly indexUseCase: IndexDocumentUseCase) {}

  async handle(event: DomainIntegrationEvent<OrderCreatedPayload>): Promise<void> {
    logger.info(`[OrderCreatedSearchProjectionHandler] Projecting ${event.eventName}`, {
      eventId: event.id,
      aggregateId: event.aggregateId
    });

    const payload = event.payload;
    await this.indexUseCase.execute({
      id: payload.orderId,
      type: 'ORDER',
      title: `Order #${payload.orderId?.substring(0, 8)}`,
      description: `Order totaling ${payload.currency || 'USD'} ${payload.totalAmount}`,
      metadata: { userId: payload.userId, totalAmount: payload.totalAmount }
    });
  }
}
