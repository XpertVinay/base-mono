import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification, NotificationChannel } from '../../domain/entities/notification.entity.js';
import { NotificationDto } from '../../shared/contracts/index.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface SendNotificationCommand {
  recipient: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
  subject: string;
  body: string;
}

export class SendNotificationUseCase implements UseCase<SendNotificationCommand, NotificationDto> {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(command: SendNotificationCommand): Promise<Result<NotificationDto>> {
    const notification = Notification.create({
      recipient: command.recipient,
      channel: command.channel as NotificationChannel,
      subject: command.subject,
      body: command.body
    });

    // In a real system or provider, dispatch email/SMS here
    logger.info(`[Simulated Dispatch] Sending ${command.channel} to ${command.recipient}: ${command.subject}`);
    notification.markSent();

    await this.repo.save(notification);

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
  }
}

export class ListNotificationsQuery implements UseCase<{ limit?: number }, NotificationDto[]> {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input: { limit?: number }): Promise<Result<NotificationDto[]>> {
    const items = await this.repo.listRecent(input.limit || 50);
    return Result.ok(
      items.map(n => ({
        id: n.id,
        recipient: n.recipient,
        channel: n.channel,
        subject: n.subject,
        body: n.body,
        status: n.status,
        sentAt: n.sentAt?.toISOString(),
        createdAt: n.createdAt.toISOString()
      }))
    );
  }
}
