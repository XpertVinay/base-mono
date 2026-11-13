import { ITransactionRepository, ListTransactionsOptions } from '../../domain/repositories/transaction-repository.interface.js';
import { Transaction, TransactionType, TransactionStatus } from '../../domain/entities/transaction.entity.js';
import { dbPool } from '../../shared/infrastructure/database/connection-pool.js';

export class PostgresTransactionRepository implements ITransactionRepository {
  async findById(id: string, tenantId?: string): Promise<Transaction | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
              failure_reason, provider, provider_session_id, provider_transaction_id, redirect_url, created_at, updated_at
       FROM transactions.transactions
       WHERE id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY CASE WHEN tenant_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction[]> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
              failure_reason, provider, provider_session_id, provider_transaction_id, redirect_url, created_at, updated_at
       FROM transactions.transactions
       WHERE reference_id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       ORDER BY created_at DESC`,
      [referenceId, tid]
    );
    return res.rows.map(r => this.mapToDomain(r));
  }

  async findByProviderSessionId(sessionId: string, tenantId?: string): Promise<Transaction | null> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
              failure_reason, provider, provider_session_id, provider_transaction_id, redirect_url, created_at, updated_at
       FROM transactions.transactions
       WHERE provider_session_id = $1 AND (tenant_id = $2 OR tenant_id = 'default')
       LIMIT 1`,
      [sessionId, tid]
    );
    if (res.rows.length === 0) return null;
    return this.mapToDomain(res.rows[0]);
  }

  async findAll(tenantId?: string, options: ListTransactionsOptions = {}): Promise<{ transactions: Transaction[]; total: number }> {
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

    if (options.type) {
      params.push(options.type.toUpperCase());
      conditions.push(`type = $${params.length}`);
    }

    if (options.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (options.search) {
      params.push(`%${options.search}%`);
      conditions.push(`(reference_id ILIKE $${params.length} OR id ILIKE $${params.length} OR user_id ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await dbPool.query(
      `SELECT COUNT(*) as count FROM transactions.transactions WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const res = await dbPool.query(
      `SELECT id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method, 
              failure_reason, provider, provider_session_id, provider_transaction_id, redirect_url, created_at, updated_at
       FROM transactions.transactions
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    );

    const transactions = res.rows.map(r => this.mapToDomain(r));
    return { transactions, total };
  }

  async save(transaction: Transaction): Promise<void> {
    await dbPool.query(
      `INSERT INTO transactions.transactions (
        id, tenant_id, reference_id, user_id, type, status, amount, currency, payment_method,
        failure_reason, provider, provider_session_id, provider_transaction_id, redirect_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        transaction.id,
        transaction.tenantId,
        transaction.referenceId,
        transaction.userId,
        transaction.type,
        transaction.status,
        transaction.amount,
        transaction.currency,
        transaction.paymentMethod,
        transaction.failureReason,
        transaction.provider,
        transaction.providerSessionId,
        transaction.providerTransactionId,
        transaction.redirectUrl,
        transaction.createdAt,
        transaction.updatedAt
      ]
    );
  }

  async update(transaction: Transaction): Promise<void> {
    await dbPool.query(
      `UPDATE transactions.transactions
       SET status = $2, failure_reason = $3, provider = $4, provider_session_id = $5,
           provider_transaction_id = $6, redirect_url = $7, updated_at = $8, payment_method = $9
       WHERE id = $1 AND (tenant_id = $10 OR tenant_id = 'default')`,
      [
        transaction.id,
        transaction.status,
        transaction.failureReason,
        transaction.provider,
        transaction.providerSessionId,
        transaction.providerTransactionId,
        transaction.redirectUrl,
        transaction.updatedAt,
        transaction.paymentMethod,
        transaction.tenantId
      ]
    );
  }

  async delete(id: string, tenantId?: string): Promise<boolean> {
    const tid = tenantId || 'default';
    const res = await dbPool.query(
      'DELETE FROM transactions.transactions WHERE id = $1 AND (tenant_id = $2 OR tenant_id = \'default\')',
      [id, tid]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapToDomain(row: any): Transaction {
    return Transaction.reconstitute(
      {
        tenantId: row.tenant_id || 'default',
        referenceId: row.reference_id,
        userId: row.user_id,
        type: row.type as TransactionType,
        status: row.status as TransactionStatus,
        amount: parseFloat(row.amount),
        currency: row.currency,
        paymentMethod: row.payment_method,
        failureReason: row.failure_reason,
        provider: row.provider,
        providerSessionId: row.provider_session_id,
        providerTransactionId: row.provider_transaction_id,
        redirectUrl: row.redirect_url,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      },
      row.id
    );
  }
}
