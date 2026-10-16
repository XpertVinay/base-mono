import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification } from '../../domain/entities/notification.entity.js';
import { SendNotificationRequestDto, NotificationDto } from '@monolith/contracts';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class SendNotificationUseCase implements IUseCase<SendNotificationRequestDto, NotificationDto> {
  constructor(private readonly repository: INotificationRepository) {}

  async execute(input: SendNotificationRequestDto): Promise<Result<NotificationDto, Error>> {
    try {
      const notification = Notification.create(
        input.recipient,
        input.channel,
        input.subject,
        input.body
      );

      // Simulate delivery attempt
      logger.info(`Sending ${input.channel} notification to ${input.recipient}`, {
        subject: input.subject
      });
      notification.markSent();

      await this.repository.save(notification);

      return Result.ok({
        id: notification.id,
        recipient: notification.recipient,
        channel: notification.channel,
        subject: notification.subject,
        body: notification.body,
        status: notification.status,
        sentAt: notification.sentAt?.toISOString(),
        createdAt: notification.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListNotificationsQuery implements IQuery<{ recipient?: string; limit?: number }, NotificationDto[]> {
  constructor(private readonly repository: INotificationRepository) {}

  async execute({ recipient, limit = 50 }: { recipient?: string; limit?: number }): Promise<Result<NotificationDto[], Error>> {
    try {
      const notifications = recipient 
        ? await this.repository.findByRecipient(recipient)
        : await this.repository.findAll(limit);

      return Result.ok(notifications.map(n => ({
        id: n.id,
        recipient: n.recipient,
        channel: n.channel,
        subject: n.subject,
        body: n.body,
        status: n.status,
        sentAt: n.sentAt?.toISOString(),
        createdAt: n.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
