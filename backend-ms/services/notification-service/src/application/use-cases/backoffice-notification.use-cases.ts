import { INotificationRepository, ListNotificationsOptions } from '../../domain/repositories/notification-repository.interface.js';
import { NotificationStatus } from '../../domain/entities/notification.entity.js';
import { Result } from '../../shared/domain/result.js';

export interface ListAllNotificationsDTO extends ListNotificationsOptions {
  tenantId?: string;
}

export interface GetNotificationByIdDTO {
  id: string;
  tenantId?: string;
}

export interface UpdateNotificationDTO {
  id: string;
  recipient?: string;
  subject?: string;
  body?: string;
  status?: NotificationStatus;
  tenantId?: string;
}

export interface DeleteNotificationDTO {
  id: string;
  tenantId?: string;
}

export class ListAllNotificationsQuery {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(dto: ListAllNotificationsDTO): Promise<Result<{ notifications: any[]; total: number; page: number; limit: number }>> {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const result = await this.repo.findAll(dto.tenantId, {
      page,
      limit,
      status: dto.status,
      channel: dto.channel,
      search: dto.search
    });

    const mapped = result.notifications.map(n => ({
      id: n.id,
      tenantId: n.tenantId,
      recipient: n.recipient,
      channel: n.channel,
      subject: n.subject,
      body: n.body,
      status: n.status,
      sentAt: n.sentAt,
      createdAt: n.createdAt
    }));

    return Result.ok({
      notifications: mapped,
      total: result.total,
      page,
      limit
    });
  }
}

export class GetNotificationByIdQuery {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(dto: GetNotificationByIdDTO): Promise<Result<any>> {
    const notif = await this.repo.findById(dto.id, dto.tenantId);
    if (!notif) {
      return Result.fail('Notification not found');
    }

    return Result.ok({
      id: notif.id,
      tenantId: notif.tenantId,
      recipient: notif.recipient,
      channel: notif.channel,
      subject: notif.subject,
      body: notif.body,
      status: notif.status,
      sentAt: notif.sentAt,
      createdAt: notif.createdAt
    });
  }
}

export class UpdateNotificationUseCase {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(dto: UpdateNotificationDTO): Promise<Result<any>> {
    const notif = await this.repo.findById(dto.id, dto.tenantId);
    if (!notif) {
      return Result.fail('Notification not found');
    }

    notif.update({
      recipient: dto.recipient,
      subject: dto.subject,
      body: dto.body,
      status: dto.status
    });

    await this.repo.update(notif);

    return Result.ok({
      id: notif.id,
      tenantId: notif.tenantId,
      recipient: notif.recipient,
      channel: notif.channel,
      subject: notif.subject,
      body: notif.body,
      status: notif.status,
      sentAt: notif.sentAt,
      createdAt: notif.createdAt
    });
  }
}

export class DeleteNotificationUseCase {
  constructor(private readonly repo: INotificationRepository) {}

  async execute(dto: DeleteNotificationDTO): Promise<Result<{ id: string; deleted: boolean }>> {
    const notif = await this.repo.findById(dto.id, dto.tenantId);
    if (!notif) {
      return Result.fail('Notification not found');
    }

    const deleted = await this.repo.delete(dto.id, dto.tenantId);
    if (!deleted) {
      return Result.fail('Failed to delete notification');
    }

    return Result.ok({ id: dto.id, deleted: true });
  }
}

