import { Router } from 'express';
import { PostgresNotificationRepository } from './infrastructure/persistence/postgres-notification.repository.js';
import {
  SendNotificationUseCase,
  SendBatchNotificationUseCase,
  ListNotificationsQuery,
  GetNotificationByIdQuery,
  GetNotificationConfigQuery,
  GetDryRunOutboxQuery,
  ClearDryRunOutboxUseCase,
  HandleNotificationWebhookUseCase
} from './application/use-cases/notification.use-cases.js';
import { NotificationController } from './presentation/http/notification.controller.js';
import { createNotificationRouter } from './presentation/http/notification.routes.js';
import { DynamicNotificationRouter, NotificationConfigResolver } from './infrastructure/adapters/dynamic-notification.router.js';
import { SendGridEmailAdapter } from './infrastructure/adapters/sendgrid-email.adapter.js';
import { TwilioSmsAdapter } from './infrastructure/adapters/twilio-sms.adapter.js';
import { MetaWhatsAppAdapter } from './infrastructure/adapters/meta-whatsapp.adapter.js';
import { FcmPushAdapter } from './infrastructure/adapters/fcm-push.adapter.js';
import { MockNotificationAdapter } from './infrastructure/adapters/mock-notification.adapter.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import {
  SendNotificationRequestDto,
  NotificationDto,
  BatchNotificationRequestDto,
  BatchNotificationResultDto
} from '@monolith/contracts';
import { IConfigModulePublicApi } from '../config/index.js';

export interface INotificationModulePublicApi {
  send(dto: SendNotificationRequestDto): Promise<NotificationDto | null>;
  sendBatch(dto: BatchNotificationRequestDto): Promise<BatchNotificationResultDto>;
  isDryRunActive(): Promise<boolean>;
}

export class NotificationModule {
  public static init(): { router: Router; publicApi: INotificationModulePublicApi } {
    const repository = new PostgresNotificationRepository();

    // Resolves database configuration flags dynamically without hardcoupling
    const configResolver: NotificationConfigResolver = async (key: string, defaultValue = '') => {
      try {
        const configApi = container.resolve<IConfigModulePublicApi>('IConfigModulePublicApi');
        return await configApi.get(key, defaultValue);
      } catch {
        return defaultValue;
      }
    };

    // Instantiate adapters for all required notification providers
    const mockAdapter = new MockNotificationAdapter();
    const sendGridAdapter = new SendGridEmailAdapter();
    const twilioAdapter = new TwilioSmsAdapter();
    const metaWhatsAdapter = new MetaWhatsAppAdapter();
    const fcmPushAdapter = new FcmPushAdapter();

    // Instantiate Dynamic Router with provider registration & dry-run configuration
    const notificationRouter = new DynamicNotificationRouter(configResolver, [
      sendGridAdapter,
      twilioAdapter,
      metaWhatsAdapter,
      fcmPushAdapter,
      mockAdapter
    ]);

    // Instantiate Use Cases
    const sendUseCase = new SendNotificationUseCase(repository, notificationRouter, eventBus);
    const sendBatchUseCase = new SendBatchNotificationUseCase(sendUseCase);
    const listQuery = new ListNotificationsQuery(repository);
    const getByIdQuery = new GetNotificationByIdQuery(repository);
    const getConfigQuery = new GetNotificationConfigQuery(notificationRouter);
    const getDryRunOutboxQuery = new GetDryRunOutboxQuery();
    const clearDryRunOutboxUseCase = new ClearDryRunOutboxUseCase();
    const webhookUseCase = new HandleNotificationWebhookUseCase(repository);

    // Controller and HTTP Router
    const controller = new NotificationController(
      sendUseCase,
      sendBatchUseCase,
      listQuery,
      getByIdQuery,
      getConfigQuery,
      getDryRunOutboxQuery,
      clearDryRunOutboxUseCase,
      webhookUseCase
    );

    const router = createNotificationRouter(controller);

    // Asynchronous Event Consumer: Listen for IAM user registrations
    eventBus.subscribe('iam.user_registered', async (event: any) => {
      logger.info('NotificationModule received iam.user_registered event', { eventId: event.id });
      const payload = event.payload as any;
      await sendUseCase.execute({
        recipient: payload.email,
        channel: 'EMAIL',
        subject: `Welcome to Platform, ${payload.name}!`,
        body: 'Your account has been successfully created. Explore our modules!'
      });
    });

    // Asynchronous Event Consumer: Listen for Order creations
    eventBus.subscribe('orders.order_created', async (event: any) => {
      logger.info('NotificationModule received orders.order_created event', { eventId: event.id });
      const payload = event.payload as any;
      await sendUseCase.execute({
        recipient: `user-${payload.userId}@notification.local`,
        channel: 'EMAIL',
        subject: `Order #${payload.orderId.substring(0, 8)} Confirmation`,
        body: `Thank you! Your order totaling ${payload.currency} ${payload.totalAmount} has been placed.`
      });
    });

    const publicApi: INotificationModulePublicApi = {
      send: async (dto) => {
        const res = await sendUseCase.execute(dto);
        return res.isSuccess ? res.getValue() : null;
      },
      sendBatch: async (dto) => {
        const res = await sendBatchUseCase.execute(dto);
        return res.isSuccess ? res.getValue() : { total: 0, sentCount: 0, failedCount: 0, results: [] };
      },
      isDryRunActive: async () => {
        return notificationRouter.isDryRunEnabled();
      }
    };

    container.register('INotificationModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
