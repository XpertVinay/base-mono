import { Notification } from '../entities/notification.entity.js';

export interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByRecipient(recipient: string): Promise<Notification[]>;
  save(notification: Notification): Promise<void>;
  findAll(limit?: number): Promise<Notification[]>;
}
