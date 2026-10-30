import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { INotificationRepository, NotificationFilter } from '../../domain/repositories/notification-repository.interface.js';
import { Notification } from '../../domain/entities/notification.entity.js';
import {
  SendNotificationRequestDto,
  NotificationDto,
  BatchNotificationRequestDto,
  BatchNotificationResultDto,
  BatchNotificationItemResult,
  NotificationConfigDto,
  NotificationDryRunOutboxItem,
  NotificationChannel
} from '@monolith/contracts';
import { DynamicNotificationRouter } from '../../infrastructure/adapters/dynamic-notification.router.js';
import { dryRunOutbox } from '../../infrastructure/adapters/dry-run-outbox.service.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class SendNotificationUseCase implements IUseCase<SendNotificationRequestDto, NotificationDto> {
  constructor(
    private readonly repository: INotificationRepository,
    private readonly router: DynamicNotificationRouter,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: SendNotificationRequestDto): Promise<Result<NotificationDto, Error>> {
    try {
      const notification = Notification.create(
        input.recipient,
        input.channel,
        input.subject,
        input.body,
        {
          provider: input.provider,
          isDryRun: input.dryRun,
          metadata: input.metadata
        }
      );

      // Dispatch through the adapter router
      const dispatchResult = await this.router.dispatch({
        id: notification.id,
        recipient: input.recipient,
        channel: input.channel,
        subject: input.subject,
        body: input.body,
        provider: input.provider,
        dryRun: input.dryRun,
        metadata: input.metadata,
        templateId: input.templateId,
        templateData: input.templateData
      });

      if (dispatchResult.status === 'SENT' || dispatchResult.status === 'DELIVERED') {
        notification.markSent(
          dispatchResult.provider,
          dispatchResult.providerMessageId,
          dispatchResult.isDryRun
        );

        if (this.eventBus) {
          await this.eventBus.publish({
            id: notification.id,
            eventName: 'notifications.sent',
            aggregateId: notification.id,
            occurredAt: new Date().toISOString(),
            version: 1,
            payload: {
              id: notification.id,
              recipient: notification.recipient,
              channel: notification.channel,
              provider: dispatchResult.provider,
              isDryRun: dispatchResult.isDryRun
            }
          });
        }
      } else {
        notification.markFailed(
          dispatchResult.errorMessage || 'Notification delivery failed',
          dispatchResult.provider
        );

        if (this.eventBus) {
          await this.eventBus.publish({
            id: notification.id,
            eventName: 'notifications.failed',
            aggregateId: notification.id,
            occurredAt: new Date().toISOString(),
            version: 1,
            payload: {
              id: notification.id,
              recipient: notification.recipient,
              channel: notification.channel,
              provider: dispatchResult.provider,
              error: dispatchResult.errorMessage
            }
          });
        }
      }

      await this.repository.save(notification);

      return Result.ok(this.mapToDto(notification));
    } catch (err: any) {
      logger.error('Failed to execute SendNotificationUseCase', { error: err.message, recipient: input.recipient });
      return Result.fail(err);
    }
  }

  private mapToDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      recipient: notification.recipient,
      channel: notification.channel,
      subject: notification.subject,
      body: notification.body,
      status: notification.status,
      provider: notification.provider,
      providerMessageId: notification.providerMessageId,
      isDryRun: notification.isDryRun,
      metadata: notification.metadata,
      errorMessage: notification.errorMessage,
      sentAt: notification.sentAt?.toISOString(),
      createdAt: notification.createdAt.toISOString()
    };
  }
}

export class SendBatchNotificationUseCase implements IUseCase<BatchNotificationRequestDto, BatchNotificationResultDto> {
  constructor(private readonly sendUseCase: SendNotificationUseCase) {}

  async execute(input: BatchNotificationRequestDto): Promise<Result<BatchNotificationResultDto, Error>> {
    try {
      const items = input.notifications || [];
      const batchDryRun = input.dryRun;

      // High-performance concurrent dispatch using Promise.all
      const promises = items.map(async (item, index): Promise<BatchNotificationItemResult> => {
        const itemResult = await this.sendUseCase.execute({
          ...item,
          dryRun: item.dryRun !== undefined ? item.dryRun : batchDryRun
        });

        if (itemResult.isSuccess) {
          return {
            index,
            recipient: item.recipient,
            channel: item.channel,
            success: true,
            notification: itemResult.getValue()
          };
        } else {
          return {
            index,
            recipient: item.recipient,
            channel: item.channel,
            success: false,
            error: itemResult.getError().message
          };
        }
      });

      const results = await Promise.all(promises);
      const sentCount = results.filter(r => r.success && r.notification?.status === 'SENT').length;
      const failedCount = results.length - sentCount;

      return Result.ok({
        total: results.length,
        sentCount,
        failedCount,
        results
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListNotificationsQuery implements IQuery<NotificationFilter, NotificationDto[]> {
  constructor(private readonly repository: INotificationRepository) {}

  async execute(filter: NotificationFilter = {}): Promise<Result<NotificationDto[], Error>> {
    try {
      const limit = filter.limit || 50;
      const notifications = await this.repository.findAll(limit, filter);

      return Result.ok(notifications.map(n => ({
        id: n.id,
        recipient: n.recipient,
        channel: n.channel,
        subject: n.subject,
        body: n.body,
        status: n.status,
        provider: n.provider,
        providerMessageId: n.providerMessageId,
        isDryRun: n.isDryRun,
        metadata: n.metadata,
        errorMessage: n.errorMessage,
        sentAt: n.sentAt?.toISOString(),
        createdAt: n.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetNotificationByIdQuery implements IQuery<{ id: string }, NotificationDto | null> {
  constructor(private readonly repository: INotificationRepository) {}

  async execute({ id }: { id: string }): Promise<Result<NotificationDto | null, Error>> {
    try {
      const notification = await this.repository.findById(id);
      if (!notification) return Result.ok(null);

      return Result.ok({
        id: notification.id,
        recipient: notification.recipient,
        channel: notification.channel,
        subject: notification.subject,
        body: notification.body,
        status: notification.status,
        provider: notification.provider,
        providerMessageId: notification.providerMessageId,
        isDryRun: notification.isDryRun,
        metadata: notification.metadata,
        errorMessage: notification.errorMessage,
        sentAt: notification.sentAt?.toISOString(),
        createdAt: notification.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetNotificationConfigQuery implements IQuery<void, NotificationConfigDto> {
  constructor(private readonly router: DynamicNotificationRouter) {}

  async execute(): Promise<Result<NotificationConfigDto, Error>> {
    try {
      const config = await this.router.getConfigSummary();
      return Result.ok(config);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetDryRunOutboxQuery implements IQuery<{ recipient?: string; channel?: NotificationChannel }, NotificationDryRunOutboxItem[]> {
  async execute(filter: { recipient?: string; channel?: NotificationChannel } = {}): Promise<Result<NotificationDryRunOutboxItem[], Error>> {
    try {
      let items = dryRunOutbox.getAll();

      if (filter.recipient) {
        items = dryRunOutbox.getByRecipient(filter.recipient);
      }
      if (filter.channel) {
        items = items.filter(i => i.channel === filter.channel);
      }

      const dtos: NotificationDryRunOutboxItem[] = items.map(item => ({
        id: item.id,
        notificationId: item.notificationId,
        recipient: item.recipient,
        channel: item.channel,
        provider: item.provider,
        subject: item.subject,
        body: item.body,
        isDryRun: item.isDryRun,
        simulatedAt: item.simulatedAt.toISOString(),
        headers: item.headers,
        payload: item.payload
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ClearDryRunOutboxUseCase implements IUseCase<void, { cleared: boolean; message: string }> {
  async execute(): Promise<Result<{ cleared: boolean; message: string }, Error>> {
    try {
      const previousCount = dryRunOutbox.count();
      dryRunOutbox.clear();
      return Result.ok({
        cleared: true,
        message: `Dry-run outbox cleared (${previousCount} items removed)`
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class HandleNotificationWebhookUseCase implements IUseCase<{ provider: string; payload: any }, { handled: boolean; provider: string; message?: string }> {
  constructor(private readonly repository: INotificationRepository) {}

  async execute(input: { provider: string; payload: any }): Promise<Result<{ handled: boolean; provider: string; message?: string }, Error>> {
    try {
      const provider = input.provider.toUpperCase();
      logger.info(`Received notification delivery webhook for provider ${provider}`, { provider });

      // Handle SendGrid Webhook events: e.g. [{ event: 'delivered', 'sg_message_id': '...' }]
      if (provider === 'SENDGRID' && Array.isArray(input.payload)) {
        for (const ev of input.payload) {
          const msgId = ev.sg_message_id?.split('.')[0];
          if (msgId && (ev.event === 'delivered' || ev.event === 'bounce')) {
            logger.info(`SendGrid status update: event=${ev.event} msgId=${msgId}`);
          }
        }
        return Result.ok({ handled: true, provider: 'SENDGRID', message: 'SendGrid webhook processed' });
      }

      // Handle Twilio status callback: { MessageSid: '...', MessageStatus: 'delivered' }
      if (provider === 'TWILIO' && input.payload?.MessageSid) {
        const sid = input.payload.MessageSid;
        const status = input.payload.MessageStatus;
        logger.info(`Twilio status update: sid=${sid} status=${status}`);
        return Result.ok({ handled: true, provider: 'TWILIO', message: 'Twilio webhook processed' });
      }

      // Handle Meta WhatsApp status webhook
      if (provider === 'META_CLOUD' || provider === 'WHATSAPP') {
        const statuses = input.payload?.entry?.[0]?.changes?.[0]?.value?.statuses;
        if (statuses && Array.isArray(statuses)) {
          for (const s of statuses) {
            logger.info(`Meta WhatsApp status update: id=${s.id} status=${s.status}`);
          }
        }
        return Result.ok({ handled: true, provider: 'META_CLOUD', message: 'WhatsApp webhook processed' });
      }

      // Read repository to maintain type reference
      void this.repository;

      return Result.ok({ handled: true, provider, message: 'Webhook received' });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
