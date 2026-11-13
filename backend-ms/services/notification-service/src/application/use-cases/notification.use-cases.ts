import { UseCase } from '../../shared/application/use-case.interface.js';
import { Result } from '../../shared/domain/result.js';
import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification, NotificationChannel } from '../../domain/entities/notification.entity.js';
import { NotificationDto } from '../../shared/contracts/index.js';

export interface SendNotificationInput {
  recipient: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK';
  subject: string;
  body: string;
  tenantId?: string;
}

export class SendNotificationUseCase implements UseCase<SendNotificationInput, NotificationDto> {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input: SendNotificationInput): Promise<Result<NotificationDto>> {
    const notification = Notification.create({
      tenantId: input.tenantId || 'default',
      recipient: input.recipient,
      channel: input.channel as NotificationChannel,
      subject: input.subject,
      body: input.body
    });

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

export class ListNotificationsQuery implements UseCase<{ limit?: number; tenantId?: string }, NotificationDto[]> {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(input?: { limit?: number; tenantId?: string }): Promise<Result<NotificationDto[]>> {
    const notifications = await this.repo.listRecent(input?.limit || 50, input?.tenantId);
    return Result.ok(
      notifications.map(n => ({
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
