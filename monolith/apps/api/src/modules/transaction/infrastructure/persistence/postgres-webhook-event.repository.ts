import {
  IWebhookEventRepository,
  WebhookEventRecord
} from '../../domain/repositories/transaction-repository.interface.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class PostgresWebhookEventRepository implements IWebhookEventRepository {
  private fallbackStore = new Set<string>();

  private makeKey(provider: string, eventId: string): string {
    return `${provider.toUpperCase()}:${eventId}`;
  }

  async hasEvent(provider: string, eventId: string): Promise<boolean> {
    const key = this.makeKey(provider, eventId);
    if (this.fallbackStore.has(key)) return true;

    try {
      const res = await dbPool.query(
        `SELECT 1 FROM transactions.webhook_events WHERE provider = $1 AND event_id = $2`,
        [provider.toUpperCase(), eventId]
      );
      return res.rows.length > 0;
    } catch {
      return this.fallbackStore.has(key);
    }
  }

  async recordEvent(event: WebhookEventRecord): Promise<void> {
    const key = this.makeKey(event.provider, event.eventId);
    this.fallbackStore.add(key);

    try {
      const id = event.id || uuidv4();
      const now = new Date();
      await dbPool.query(
        `INSERT INTO transactions.webhook_events 
         (id, tenant_id, provider, event_id, event_type, payload, status, processed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (provider, event_id) DO NOTHING`,
        [
          id,
          event.tenantId || null,
          event.provider.toUpperCase(),
          event.eventId,
          event.eventType,
          JSON.stringify(event.payload || {}),
          event.status || 'PROCESSED',
          event.processedAt || now,
          event.createdAt || now
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist webhook event in DB, stored in fallback set', {
        provider: event.provider,
        eventId: event.eventId,
        error: (err as any)?.message
      });
    }
  }
}
