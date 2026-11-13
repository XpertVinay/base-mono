import { Transaction } from '../entities/transaction.entity.js';

export interface ITransactionRepository {
  findById(id: string, tenantId?: string): Promise<Transaction | null>;
  findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction[]>;
  findByProviderSessionId(sessionId: string, tenantId?: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
}
