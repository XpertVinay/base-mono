import { INotificationRepository } from '../../domain/repositories/notification-repository.interface.js';
import { Notification, NotificationChannel } from '../../domain/entities/notification.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresNotificationRepository implements INotificationRepository {
  async findById(id: string, tenantId?: string): Promise<Notification | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, recipient, channel, subject, body, status, sent_at, created_at
       FROM notification.notifications
       WHERE id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id, tid]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const notif = Notification.create(
      {
        tenantId: row.tenant_id,
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

  async listRecent(limit: number = 50, tenantId?: string): Promise<Notification[]> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, recipient, channel, subject, body, status, sent_at, created_at
       FROM notification.notifications
       WHERE tenant_id = $1 OR tenant_id = 'default'
       ORDER BY created_at DESC
       LIMIT $2`,
      [tid, limit]
    );
    return res.rows.map(row => {
      const notif = Notification.create(
        {
          tenantId: row.tenant_id,
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
      `INSERT INTO notification.notifications (id, tenant_id, recipient, channel, subject, body, status, sent_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        notification.id,
        notification.tenantId,
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
       WHERE id = $1 AND (tenant_id = $4 OR tenant_id = 'default')`,
      [notification.id, notification.status, notification.sentAt, notification.tenantId]
    );
  }
}
