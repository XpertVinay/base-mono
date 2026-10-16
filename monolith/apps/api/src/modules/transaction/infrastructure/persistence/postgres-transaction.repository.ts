import { ITransactionRepository } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresTransactionRepository implements ITransactionRepository {
  private fallbackStore: Map<string, Transaction> = new Map();

  async findById(id: string): Promise<Transaction | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions WHERE id = $1`,
        [id]
      );
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findBySessionId(sessionId: string): Promise<Transaction | null> {
    try {
      const res = await dbPool.query(
        `SELECT id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions WHERE provider_session_id = $1 OR id = $1`,
        [sessionId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).find(t => t.providerSessionId === sessionId || t.id === sessionId) || null;
      }
      return this.mapToDomain(res.rows[0]);
    } catch {
      return Array.from(this.fallbackStore.values()).find(t => t.providerSessionId === sessionId || t.id === sessionId) || null;
    }
  }

  async findByReferenceId(referenceId: string): Promise<Transaction[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions WHERE reference_id = $1 ORDER BY created_at DESC`,
        [referenceId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(t => t.referenceId === referenceId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(t => t.referenceId === referenceId);
    }
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    try {
      const res = await dbPool.query(
        `SELECT id, reference_id, user_id, type, status, amount, currency, payment_method, 
                provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at 
         FROM transactions.transactions WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(t => t.userId === userId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(t => t.userId === userId);
    }
  }

  async save(transaction: Transaction): Promise<void> {
    this.fallbackStore.set(transaction.id, transaction);
    try {
      await dbPool.query(
        `INSERT INTO transactions.transactions 
         (id, reference_id, user_id, type, status, amount, currency, payment_method, provider, provider_session_id, provider_transaction_id, redirect_url, failure_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      logger.warn('Failed to persist transaction in DB, saved in fallback store', { id: transaction.id, error: (err as any)?.message });
    }
  }

  async update(transaction: Transaction): Promise<void> {
    await this.save(transaction);
  }

  private mapToDomain(row: any): Transaction {
    return Transaction.reconstitute(row.id, {
      referenceId: row.reference_id,
      userId: row.user_id,
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
