import { RabbitMQService } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { IIntegrationEventHandler } from './event-handler.interface.js';
import { logger } from '../../shared/infrastructure/logger.js';

/**
 * DIP & OCP: Registry / Dispatcher that binds separate event handlers to their own queues.
 * New event types can be added freely without modifying this subscriber coordinator.
 */
export class NotificationEventSubscriber {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly handlers: IIntegrationEventHandler[]
  ) {}

  public async subscribeAll(): Promise<void> {
    for (const handler of this.handlers) {
      logger.info(
        `[NotificationEventSubscriber] Registering dedicated queue '${handler.queueName}' for event '${handler.eventName}'`
      );

      await this.rabbitmq.subscribe(
        handler.queueName,
        [handler.eventName],
        async (event) => {
          try {
            await handler.handle(event);
          } catch (err) {
            logger.error(
              `[NotificationEventSubscriber] Uncaught error in handler for ${handler.eventName}`,
              err,
              { eventId: event.id }
            );
            throw err; // triggers NACK in RabbitMQ service for retry/DLQ
          }
        }
      );
    }
  }
}
