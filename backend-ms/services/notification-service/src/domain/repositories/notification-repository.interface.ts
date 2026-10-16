import { Notification } from '../entities/notification.entity.js';

export interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  listRecent(limit?: number): Promise<Notification[]>;
  save(notification: Notification): Promise<void>;
  update(notification: Notification): Promise<void>;
}
