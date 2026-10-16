import { Router } from 'express';
import { PostgresNotificationRepository } from './infrastructure/persistence/postgres-notification.repository.js';
import { SendNotificationUseCase, ListNotificationsQuery } from './application/use-cases/notification.use-cases.js';
import { NotificationController } from './presentation/http/notification.controller.js';
import { createNotificationRouter } from './presentation/http/notification.routes.js';
import { eventBus } from '../../infrastructure/messaging/event-bus.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { SendNotificationRequestDto, NotificationDto } from '@monolith/contracts';

export interface INotificationModulePublicApi {
  send(dto: SendNotificationRequestDto): Promise<NotificationDto | null>;
}

export class NotificationModule {
  public static init(): { router: Router; publicApi: INotificationModulePublicApi } {
    const repository = new PostgresNotificationRepository();
    const sendUseCase = new SendNotificationUseCase(repository);
    const listQuery = new ListNotificationsQuery(repository);

    const controller = new NotificationController(sendUseCase, listQuery);
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
      }
    };

    container.register('INotificationModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
