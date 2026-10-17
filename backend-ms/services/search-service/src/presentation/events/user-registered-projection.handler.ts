import { ISearchProjectionEventHandler } from './event-handler.interface.js';
import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { IndexDocumentUseCase } from '../../application/use-cases/search.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * SRP: Dedicated handler solely responsible for indexing user documents into search.
 */
export class UserRegisteredSearchProjectionHandler implements ISearchProjectionEventHandler<UserRegisteredPayload> {
  readonly eventName = 'iam.user_registered';
  readonly queueName = 'search-service-user-indexer';

  constructor(private readonly indexUseCase: IndexDocumentUseCase) {}

  async handle(event: DomainIntegrationEvent<UserRegisteredPayload>): Promise<void> {
    logger.info(`[UserRegisteredSearchProjectionHandler] Projecting ${event.eventName}`, {
      eventId: event.id,
      aggregateId: event.aggregateId
    });

    const payload = event.payload;
    await this.indexUseCase.execute({
      id: payload.userId,
      type: 'USER',
      title: payload.name,
      description: `User member: ${payload.email} (${payload.role})`,
      metadata: { email: payload.email, role: payload.role }
    });
  }
}
