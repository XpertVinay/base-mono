import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification, NotificationChannel } from '../../domain/entities/notification.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresNotificationRepository implements INotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    const res = await dbPool.query(
      'SELECT id, recipient, channel, subject, body, status, sent_at, created_at FROM notification.notifications WHERE id = $1',
      [id]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const notif = Notification.create(
      {
        recipient: row.recipient,
        channel: row.channel as NotificationChannel,
        subject: row.subject,
        body: row.body
      },
      row.id
    );
    if (row.status === 'SENT') notif.markSent();
    if (row.status === 'FAILED') notif.markFailed();
    return notif;
  }

  async listRecent(limit: number = 50): Promise<Notification[]> {
    const res = await dbPool.query(
      'SELECT id, recipient, channel, subject, body, status, sent_at, created_at FROM notification.notifications ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.rows.map(row => {
      const notif = Notification.create(
        {
          recipient: row.recipient,
          channel: row.channel as NotificationChannel,
          subject: row.subject,
          body: row.body
        },
        row.id
      );
      if (row.status === 'SENT') notif.markSent();
      if (row.status === 'FAILED') notif.markFailed();
      return notif;
    });
  }

  async save(notification: Notification): Promise<void> {
    await dbPool.query(
      `INSERT INTO notification.notifications (id, recipient, channel, subject, body, status, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        notification.id,
        notification.recipient,
        notification.channel,
        notification.subject,
        notification.body,
        notification.status,
        notification.sentAt,
        notification.createdAt
      ]
    );
  }

  async update(notification: Notification): Promise<void> {
    await dbPool.query(
      `UPDATE notification.notifications
       SET status = $2, sent_at = $3
       WHERE id = $1`,
      [notification.id, notification.status, notification.sentAt]
    );
  }
}
