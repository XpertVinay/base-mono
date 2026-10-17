import { RabbitMQService } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { ISearchProjectionEventHandler } from './event-handler.interface.js';
import { logger } from '../../shared/infrastructure/logger.js';

export class SearchEventSubscriber {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly handlers: ISearchProjectionEventHandler[]
  ) {}

  public async subscribeAll(): Promise<void> {
    for (const handler of this.handlers) {
      logger.info(
        `[SearchEventSubscriber] Registering dedicated projection queue '${handler.queueName}' for event '${handler.eventName}'`
      );

      await this.rabbitmq.subscribe(
        handler.queueName,
        [handler.eventName],
        async (event) => {
          try {
            await handler.handle(event);
          } catch (err) {
            logger.error(`[SearchEventSubscriber] Projection error for ${handler.eventName}`, err);
            throw err;
          }
        }
      );
    }
  }
}
