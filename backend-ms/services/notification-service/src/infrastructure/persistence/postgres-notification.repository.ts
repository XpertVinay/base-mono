import { INotificationRepository, ListNotificationsOptions } from '../../domain/repositories/notification-repository.interface.js';
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
    return this.mapToDomain(res.rows[0]);
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
    return res.rows.map(row => this.mapToDomain(row));
  }

  async findAll(tenantId?: string, options: ListNotificationsOptions = {}): Promise<{ notifications: Notification[]; total: number }> {
    const tid = tenantId || 'default';
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["(tenant_id = $1 OR tenant_id = 'default')"];
    const params: any[] = [tid];

    if (options.status) {
      params.push(options.status.toUpperCase());
      conditions.push(`status = $${params.length}`);
    }

    if (options.channel) {
      params.push(options.channel.toUpperCase());
      conditions.push(`channel = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(recipient ILIKE $${params.length} OR subject ILIKE $${params.length} OR body ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await dbPool.query(
      `SELECT COUNT(*) as count FROM notification.notifications WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const res = await dbPool.query(
      `SELECT id, tenant_id, recipient, channel, subject, body, status, sent_at, created_at
       FROM notification.notifications
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const notifications = res.rows.map(row => this.mapToDomain(row));
    return { notifications, total };
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
       SET recipient = $2, subject = $3, body = $4, status = $5, sent_at = $6
       WHERE id = $1 AND (tenant_id = $7 OR tenant_id = 'default')`,
      [
        notification.id,
        notification.recipient,
        notification.subject,
        notification.body,
        notification.status,
        notification.sentAt,
        notification.tenantId
      ]
    );
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      'DELETE FROM notification.notifications WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')',
      [id, tid]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): Notification {
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
}
