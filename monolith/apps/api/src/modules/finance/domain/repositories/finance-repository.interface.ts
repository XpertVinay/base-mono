import { ExpenseRecord } from '../entities/expense-record.entity.js';

export interface IFinanceRepository {
  save(expense: ExpenseRecord): Promise<void>;
  update(expense: ExpenseRecord): Promise<void>;
  findById(id: string): Promise<ExpenseRecord | null>;
  findByPropertyId(propertyId: string): Promise<ExpenseRecord[]>;
  findAll(): Promise<ExpenseRecord[]>;
}
