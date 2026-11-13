import { Transaction } from '../entities/transaction.entity.js';

export interface ListTransactionsOptions {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  userId?: string;
  search?: string;
}

export interface ITransactionRepository {
  findById(id: string, tenantId?: string): Promise<Transaction | null>;
  findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction[]>;
  findByProviderSessionId(sessionId: string, tenantId?: string): Promise<Transaction | null>;
  findAll(tenantId?: string, options?: ListTransactionsOptions): Promise<{ transactions: Transaction[]; total: number }>;
  save(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
