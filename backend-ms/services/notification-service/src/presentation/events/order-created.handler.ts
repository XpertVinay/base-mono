import { IIntegrationEventHandler } from './event-handler.interface.js';
import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { SendNotificationUseCase } from '../../application/use-cases/notification.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  totalAmount: number;
  currency: string;
  items?: Array<{ productId: string; quantity: number; unitPrice: number }>;
}

/**
 * SRP: Dedicated handler solely responsible for order creation notifications.
 */
export class OrderCreatedNotificationHandler implements IIntegrationEventHandler<OrderCreatedPayload> {
  readonly eventName = 'orders.order_created';
  readonly queueName = 'notification-service-order-created';

  constructor(private readonly sendNotificationUseCase: SendNotificationUseCase) {}

  async handle(event: DomainIntegrationEvent<OrderCreatedPayload>): Promise<void> {
    logger.info(`[OrderCreatedNotificationHandler] Processing ${event.eventName}`, {
      eventId: event.id,
      aggregateId: event.aggregateId
    });

    const payload = event.payload;
    if (!payload?.userId) {
      logger.warn('[OrderCreatedNotificationHandler] Skipping: missing userId', { payload });
      return;
    }

    const recipient = `user-${payload.userId}@platform.local`;

    await this.sendNotificationUseCase.execute({
      recipient,
      channel: 'EMAIL',
      subject: `Order #${payload.orderId?.substring(0, 8)} Created`,
      body: `Your order totaling ${payload.currency || 'USD'} ${payload.totalAmount} has been registered.`
    });
  }
}
