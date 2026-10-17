import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';

export interface ISearchProjectionEventHandler<T = any> {
  readonly eventName: string;
  readonly queueName: string;
  handle(event: DomainIntegrationEvent<T>): Promise<void>;
}
