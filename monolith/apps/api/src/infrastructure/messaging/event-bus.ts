import { DomainIntegrationEvent } from '@monolith/contracts';
import { logger } from '../../shared/infrastructure/logger.js';

export type EventHandler<T = any> = (event: DomainIntegrationEvent<T>) => Promise<void>;

export interface IEventBus {
  publish<T>(event: DomainIntegrationEvent<T>): Promise<void>;
  subscribe<T>(eventName: string, handler: EventHandler<T>): void;
}

export class InMemoryEventBus implements IEventBus {
  private static instance: InMemoryEventBus;
  private handlers: Map<string, EventHandler[]> = new Map();

  public static getInstance(): InMemoryEventBus {
    if (!InMemoryEventBus.instance) {
      InMemoryEventBus.instance = new InMemoryEventBus();
    }
    return InMemoryEventBus.instance;
  }

  public subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) || [];
    list.push(handler as EventHandler);
    this.handlers.set(eventName, list);
    logger.debug(`Subscribed handler to event: ${eventName}`);
  }

  public async publish<T>(event: DomainIntegrationEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.eventName) || [];
    logger.info(`Dispatching event: ${event.eventName}`, {
      eventId: event.id,
      aggregateId: event.aggregateId,
      subscribersCount: handlers.length
    });

    // Execute handlers asynchronously with error isolation
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`Handler failed for event ${event.eventName}`, err, {
          eventId: event.id,
          aggregateId: event.aggregateId
        });
      }
    }
  }
}

export const eventBus = InMemoryEventBus.getInstance();
