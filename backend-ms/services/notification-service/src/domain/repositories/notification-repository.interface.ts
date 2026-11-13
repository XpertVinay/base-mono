import { Notification } from '../entities/notification.entity.js';

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  status?: string;
  channel?: string;
  search?: string;
}

export interface INotificationRepository {
  findById(id: string, tenantId?: string): Promise<Notification | null>;
  listRecent(limit?: number, tenantId?: string): Promise<Notification[]>;
  findAll(tenantId?: string, options?: ListNotificationsOptions): Promise<{ notifications: Notification[]; total: number }>;
  save(notification: Notification): Promise<void>;
  update(notification: Notification): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
