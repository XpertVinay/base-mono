import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification } from '../../domain/entities/notification.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresNotificationRepository implements INotificationRepository {
  private fallbackStore: Map<string, Notification> = new Map();

  async findById(id: string): Promise<Notification | null> {
    try {
      const res = await dbPool.query(
        'SELECT id, recipient, channel, subject, body, status, sent_at, created_at FROM notification.notifications WHERE id = $1',
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByRecipient(recipient: string): Promise<Notification[]> {
    try {
      const res = await dbPool.query(
        'SELECT id, recipient, channel, subject, body, status, sent_at, created_at FROM notification.notifications WHERE recipient = $1 ORDER BY created_at DESC',
        [recipient]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(n => n.recipient === recipient);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(n => n.recipient === recipient);
    }
  }

  async findAll(limit = 50): Promise<Notification[]> {
    try {
      const res = await dbPool.query(
        'SELECT id, recipient, channel, subject, body, status, sent_at, created_at FROM notification.notifications ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values()).slice(0, limit);
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).slice(0, limit);
    }
  }

  async save(notification: Notification): Promise<void> {
    this.fallbackStore.set(notification.id, notification);
    try {
      await dbPool.query(
        `INSERT INTO notification.notifications (id, recipient, channel, subject, body, status, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           sent_at = EXCLUDED.sent_at`,
        [
          notification.id,
          notification.recipient,
          notification.channel,
          notification.subject,
          notification.body,
          notification.status,
          notification.sentAt || null,
          notification.createdAt
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist notification in DB, stored in fallback store', { id: notification.id });
    }
  }

  private mapToDomain(row: any): Notification {
    return Notification.reconstitute(row.id, {
      recipient: row.recipient,
      channel: row.channel,
      subject: row.subject,
      body: row.body,
      status: row.status,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      createdAt: new Date(row.created_at)
    });
  }
}
