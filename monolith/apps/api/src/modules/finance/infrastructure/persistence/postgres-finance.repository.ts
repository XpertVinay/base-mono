import { IFinanceRepository } from '../../domain/repositories/finance-repository.interface.js';
import { ExpenseRecord } from '../../domain/entities/expense-record.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresFinanceRepository implements IFinanceRepository {
  private fallbackStore: Map<string, ExpenseRecord> = new Map();

  async save(expense: ExpenseRecord): Promise<void> {
    this.fallbackStore.set(expense.id, expense);
    try {
      await dbPool.query(
        `INSERT INTO finance.expenses (id, property_id, creator_id, payee_name, expense_type, amount, description, invoice_url, status, approved_by, approved_at, settled_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           approved_by = EXCLUDED.approved_by,
           approved_at = EXCLUDED.approved_at,
           settled_at = EXCLUDED.settled_at,
           updated_at = EXCLUDED.updated_at`,
        [
          expense.id,
          expense.propertyId,
          expense.creatorId,
          expense.payeeName,
          expense.expenseType,
          expense.amount,
          expense.description,
          expense.invoiceUrl,
          expense.status,
          expense.approvedBy,
          expense.approvedAt,
          expense.settledAt,
          expense.createdAt,
          expense.updatedAt
        ]
      );
    } catch {
      logger.warn('Database save failed in PostgresFinanceRepository, using fallback store', { expenseId: expense.id });
    }
  }

  async update(expense: ExpenseRecord): Promise<void> {
    await this.save(expense);
  }

  async findById(id: string): Promise<ExpenseRecord | null> {
    try {
      const res = await dbPool.query('SELECT * FROM finance.expenses WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.fallbackStore.get(id) || null;
      return this.mapToDomain(res.rows[0]);
    } catch {
      return this.fallbackStore.get(id) || null;
    }
  }

  async findByPropertyId(propertyId: string): Promise<ExpenseRecord[]> {
    try {
      const res = await dbPool.query('SELECT * FROM finance.expenses WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.fallbackStore.values()).filter(e => e.propertyId === propertyId);
      }
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values()).filter(e => e.propertyId === propertyId);
    }
  }

  async findAll(): Promise<ExpenseRecord[]> {
    try {
      const res = await dbPool.query('SELECT * FROM finance.expenses ORDER BY created_at DESC');
      if (res.rows.length === 0) return Array.from(this.fallbackStore.values());
      return res.rows.map(this.mapToDomain);
    } catch {
      return Array.from(this.fallbackStore.values());
    }
  }

  private mapToDomain(row: any): ExpenseRecord {
    return ExpenseRecord.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      creatorId: row.creator_id,
      payeeName: row.payee_name,
      expenseType: row.expense_type,
      amount: Number(row.amount),
      description: row.description,
      invoiceUrl: row.invoice_url || null,
      status: row.status,
      approvedBy: row.approved_by || null,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
      settledAt: row.settled_at ? new Date(row.settled_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
