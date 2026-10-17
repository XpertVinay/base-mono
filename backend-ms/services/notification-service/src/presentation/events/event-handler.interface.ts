import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';

/**
 * ISP & DIP: Contract for integration event handlers.
 * Each handler has a single responsibility (SRP) and can be extended without modifying existing code (OCP).
 */
export interface IIntegrationEventHandler<T = any> {
  readonly eventName: string;
  readonly queueName: string;
  handle(event: DomainIntegrationEvent<T>): Promise<void>;
}
