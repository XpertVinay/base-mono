import { ITransactionRepository } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresTransactionRepository implements ITransactionRepository {
  private fallbackStore: Map<string, Transaction> = new Map();

  private clone(t: Transaction): Transaction {
    return Transaction.reconstitute(t.id, {
      referenceId: t.referenceId,
      userId: t.userId,
      tenantId: t.tenantId,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      paymentMethod: t.paymentMethod,
      provider: t.provider,
      providerSessionId: t.providerSessionId,
      providerTransactionId: t.providerTransactionId,
      redirectUrl: t.redirectUrl,
      failureReason: t.failureReason,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt
    });
  }

  async findById(id: string, tenantId?: string): Promise<Transaction | null> {
    try {
      let query = `
        SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
               provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
        FROM transactions.transactions 
        WHERE id = $1
      `;
      const params: any[] = [id];

      if (tenantId) {
        query += ` AND tenant_id = $2`;
        params.push(tenantId);
      }

      const res = await dbPool.query(query, params);
      if (res.rows.length === 0) {
        return this.getFromFallback(id, tenantId);
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.getFromFallback(id, tenantId);
    }
  }

  private getFromFallback(id: string, tenantId?: string): Transaction | null {
    const item = this.fallbackStore.get(id);
    if (!item) return null;
    if (tenantId && item.tenantId !== tenantId) return null;
    return this.clone(item);
  }

  async findBySessionId(sessionId: string): Promise<Transaction | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions 
         WHERE provider_session_id = $1 OR id = $1`,
        [sessionId]
      );
      if (res.rows.length === 0) {
        const found = Array.from(this.fallbackStore.values()).find(
          t => t.providerSessionId === sessionId || t.id === sessionId
        );
        return found ? this.clone(found) : null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      const found = Array.from(this.fallbackStore.values()).find(
        t => t.providerSessionId === sessionId || t.id === sessionId
      );
      return found ? this.clone(found) : null;
    }
  }

  async findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction[]> {
    try {
      let query = `
        SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
               provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
        FROM transactions.transactions 
        WHERE reference_id = $1
      `;
      const params: any[] = [referenceId];

      if (tenantId) {
        query += ` AND tenant_id = $2`;
        params.push(tenantId);
      }
      query += ` ORDER BY created_at DESC`;

      const res = await dbPool.query(query, params);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values())
          .filter(t => t.referenceId === referenceId && (!tenantId || t.tenantId === tenantId))
          .map(t => this.clone(t));
      }
      return res.rows.map(r => this.mapToDomain(r));
    } catch {
      return Array.from(this.fallbackStore.values())
        .filter(t => t.referenceId === referenceId && (!tenantId || t.tenantId === tenantId))
        .map(t => this.clone(t));
    }
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Transaction[]> {
    try {
      let query = `
        SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
               provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
        FROM transactions.transactions 
        WHERE user_id = $1
      `;
      const params: any[] = [userId];

      if (tenantId) {
        query += ` AND tenant_id = $2`;
        params.push(tenantId);
      }
      query += ` ORDER BY created_at DESC`;

      const res = await dbPool.query(query, params);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values())
          .filter(t => t.userId === userId && (!tenantId || t.tenantId === tenantId))
          .map(t => this.clone(t));
      }
      return res.rows.map(r => this.mapToDomain(r));
    } catch {
      return Array.from(this.fallbackStore.values())
        .filter(t => t.userId === userId && (!tenantId || t.tenantId === tenantId))
        .map(t => this.clone(t));
    }
  }

  async findByTenantId(
    tenantId: string,
    limit = 50,
    offset = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const countRes = await dbPool.query(
        `SELECT COUNT(*) as count FROM transactions.transactions WHERE tenant_id = $1`,
        [tenantId]
      );
      const total = parseInt(countRes.rows[0]?.count || '0', 10);

      const res = await dbPool.query(
        `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );

      return {
        transactions: res.rows.map(r => this.mapToDomain(r)),
        total
      };
    } catch {
      const all = Array.from(this.fallbackStore.values()).filter(t => t.tenantId === tenantId);
      const paged = all.slice(offset, offset + limit).map(t => this.clone(t));
      return { transactions: paged, total: all.length };
    }
  }

  async save(transaction: Transaction): Promise<void> {
    this.fallbackStore.set(transaction.id, this.clone(transaction));
    try {
      await dbPool.query(
        `INSERT INTO transactions.transactions 
         (id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           payment_method = EXCLUDED.payment_method,
           provider = EXCLUDED.provider,
           provider_session_id = EXCLUDED.provider_session_id,
           provider_transaction_id = EXCLUDED.provider_transaction_id,
           redirect_url = EXCLUDED.redirect_url,
           failure_reason = EXCLUDED.failure_reason,
           updated_at = EXCLUDED.updated_at`,
        [
          transaction.id,
          transaction.tenantId || null,
          transaction.referenceId,
          transaction.userId,
          transaction.type,
          transaction.status,
          transaction.amount,
          transaction.currency,
          transaction.paymentMethod,
          transaction.provider || null,
          transaction.providerSessionId || null,
          transaction.providerTransactionId || null,
          transaction.redirectUrl || null,
          transaction.failureReason || null,
          transaction.createdAt,
          transaction.updatedAt
        ]
      );
    } catch (err) {
      logger.warn('Failed to persist transaction in DB, saved in fallback store', {
        id: transaction.id,
        tenantId: transaction.tenantId,
        error: (err as any)?.message
      });
    }
  }

  async update(transaction: Transaction): Promise<void> {
    await this.save(transaction);
  }

  private mapToDomain(row: any): Transaction {
    return Transaction.reconstitute(row.id, {
      referenceId: row.reference_id,
      userId: row.user_id,
      tenantId: row.tenant_id || undefined,
      type: row.type,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      paymentMethod: row.payment_method,
      provider: row.provider || undefined,
      providerSessionId: row.provider_session_id || undefined,
      providerTransactionId: row.provider_transaction_id || undefined,
      redirectUrl: row.redirect_url || undefined,
      failureReason: row.failure_reason || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
