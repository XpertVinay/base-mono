export { NotificationModule, type INotificationModulePublicApi } from './notification.module.js';
export {
  Notification,
  type NotificationProps
} from './domain/entities/notification.entity.js';
export {
  type INotificationRepository,
  type NotificationFilter
} from './domain/repositories/notification-repository.interface.js';
export { PostgresNotificationRepository } from './infrastructure/persistence/postgres-notification.repository.js';
export {
  DynamicNotificationRouter,
  type NotificationConfigResolver
} from './infrastructure/adapters/dynamic-notification.router.js';
export { DryRunOutboxService } from './infrastructure/adapters/dry-run-outbox.service.js';
export { MockNotificationAdapter } from './infrastructure/adapters/mock-notification.adapter.js';
export { SendGridEmailAdapter } from './infrastructure/adapters/sendgrid-email.adapter.js';
export { TwilioSmsAdapter } from './infrastructure/adapters/twilio-sms.adapter.js';
export { MetaWhatsAppAdapter } from './infrastructure/adapters/meta-whatsapp.adapter.js';
export { FcmPushAdapter } from './infrastructure/adapters/fcm-push.adapter.js';
export {
  SendNotificationUseCase,
  SendBatchNotificationUseCase,
  ListNotificationsQuery,
  GetNotificationByIdQuery,
  GetNotificationConfigQuery,
  GetDryRunOutboxQuery,
  ClearDryRunOutboxUseCase,
  HandleNotificationWebhookUseCase
} from './application/use-cases/notification.use-cases.js';
export { NotificationController } from './presentation/http/notification.controller.js';
export { createNotificationRouter } from './presentation/http/notification.routes.js';
