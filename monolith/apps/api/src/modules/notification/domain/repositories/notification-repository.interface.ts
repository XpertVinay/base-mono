import { Notification } from '../entities/notification.entity.js';
import { NotificationChannel, NotificationStatus } from '@monolith/contracts';

export interface NotificationFilter {
  recipient?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  limit?: number;
  offset?: number;
}

export interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByRecipient(recipient: string): Promise<Notification[]>;
  findAll(limit?: number, filter?: NotificationFilter): Promise<Notification[]>;
  save(notification: Notification): Promise<void>;
}
