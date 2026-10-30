import { INotificationRepository, NotificationFilter } from '../../domain/repositories/notification-repository.interface.js';
import { Notification } from '../../domain/entities/notification.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresNotificationRepository implements INotificationRepository {
  private fallbackStore: Map<string, Notification> = new Map();

  async findById(id: string): Promise<Notification | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, recipient, channel, subject, body, status, provider, provider_message_id, is_dry_run, metadata, error_message, sent_at, created_at 
         FROM notification.notifications WHERE id = $1`,
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
        `SELECT id, recipient, channel, subject, body, status, provider, provider_message_id, is_dry_run, metadata, error_message, sent_at, created_at 
         FROM notification.notifications WHERE recipient = $1 ORDER BY created_at DESC`,
        [recipient]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(n => n.recipient === recipient);
      }
      return res.rows.map(row => this.mapToDomain(row));
    } catch {
      return Array.from(this.fallbackStore.values()).filter(n => n.recipient === recipient);
    }
  }

  async findAll(limit = 50, filter?: NotificationFilter): Promise<Notification[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let index = 1;

      if (filter?.recipient) {
        conditions.push(`recipient = $${index++}`);
        values.push(filter.recipient);
      }
      if (filter?.channel) {
        conditions.push(`channel = $${index++}`);
        values.push(filter.channel);
      }
      if (filter?.status) {
        conditions.push(`status = $${index++}`);
        values.push(filter.status);
      }

      values.push(limit);
      const limitIndex = index;

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT id, recipient, channel, subject, body, status, provider, provider_message_id, is_dry_run, metadata, error_message, sent_at, created_at 
        FROM notification.notifications 
        ${whereClause}
        ORDER BY created_at DESC LIMIT $${limitIndex}
      `;

      const res = await dbPool.query(query, values);
      if (res.rows.length === 0) {
        return this.queryFallback(limit, filter);
      }
      return res.rows.map(row => this.mapToDomain(row));
    } catch {
      return this.queryFallback(limit, filter);
    }
  }

  private queryFallback(limit = 50, filter?: NotificationFilter): Notification[] {
    let list = Array.from(this.fallbackStore.values());
    if (filter?.recipient) {
      list = list.filter(n => n.recipient === filter.recipient);
    }
    if (filter?.channel) {
      list = list.filter(n => n.channel === filter.channel);
    }
    if (filter?.status) {
      list = list.filter(n => n.status === filter.status);
    }
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list.slice(0, limit);
  }

  async save(notification: Notification): Promise<void> {
    this.fallbackStore.set(notification.id, notification);
    try {
      await dbPool.query(
        `INSERT INTO notification.notifications 
         (id, recipient, channel, subject, body, status, provider, provider_message_id, is_dry_run, metadata, error_message, sent_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           provider = EXCLUDED.provider,
           provider_message_id = EXCLUDED.provider_message_id,
           is_dry_run = EXCLUDED.is_dry_run,
           metadata = EXCLUDED.metadata,
           error_message = EXCLUDED.error_message,
           sent_at = EXCLUDED.sent_at`,
        [
          notification.id,
          notification.recipient,
          notification.channel,
          notification.subject,
          notification.body,
          notification.status,
          notification.provider || null,
          notification.providerMessageId || null,
          notification.isDryRun,
          notification.metadata ? JSON.stringify(notification.metadata) : null,
          notification.errorMessage || null,
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
      provider: row.provider || undefined,
      providerMessageId: row.provider_message_id || undefined,
      isDryRun: row.is_dry_run === true || row.is_dry_run === 'true',
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || undefined),
      errorMessage: row.error_message || undefined,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      createdAt: new Date(row.created_at)
    });
  }
}
