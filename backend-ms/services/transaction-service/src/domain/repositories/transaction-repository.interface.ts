import { Transaction } from '../entities/transaction.entity.js';

export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByReferenceId(referenceId: string): Promise<Transaction[]>;
  findByProviderSessionId(sessionId: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
}
