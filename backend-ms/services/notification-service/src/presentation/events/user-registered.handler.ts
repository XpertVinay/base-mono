import { IIntegrationEventHandler } from './event-handler.interface.js';
import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';
import { SendNotificationUseCase } from '../../application/use-cases/notification.use-cases.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * SRP: Dedicated handler solely responsible for user registration notifications.
 */
export class UserRegisteredNotificationHandler implements IIntegrationEventHandler<UserRegisteredPayload> {
  readonly eventName = 'iam.user_registered';
  readonly queueName = 'notification-service-user-registered';

  constructor(private readonly sendNotificationUseCase: SendNotificationUseCase) {}

  async handle(event: DomainIntegrationEvent<UserRegisteredPayload>): Promise<void> {
    logger.info(`[UserRegisteredNotificationHandler] Processing ${event.eventName}`, {
      eventId: event.id,
      aggregateId: event.aggregateId
    });

    const payload = event.payload;
    if (!payload?.email) {
      logger.warn('[UserRegisteredNotificationHandler] Skipping: missing recipient email', { payload });
      return;
    }

    await this.sendNotificationUseCase.execute({
      recipient: payload.email,
      channel: 'EMAIL',
      subject: `Welcome to the Microservices Platform, ${payload.name || 'User'}!`,
      body: 'Your account has been created successfully. Welcome aboard!'
    });
  }
}
