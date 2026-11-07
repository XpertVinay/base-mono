import { Transaction } from '../entities/transaction.entity.js';

export interface ITransactionRepository {
  findById(id: string, tenantId?: string): Promise<Transaction | null>;
  findByReferenceId(referenceId: string, tenantId?: string): Promise<Transaction[]>;
  findByUserId(userId: string, tenantId?: string): Promise<Transaction[]>;
  findByTenantId(tenantId: string, limit?: number, offset?: number): Promise<{ transactions: Transaction[]; total: number }>;
  findBySessionId(sessionId: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
  update(transaction: Transaction): Promise<void>;
}

export interface WebhookEventRecord {
  id?: string;
  tenantId?: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: any;
  status?: string;
  processedAt?: Date;
  createdAt?: Date;
}

export interface IWebhookEventRepository {
  hasEvent(provider: string, eventId: string): Promise<boolean>;
  recordEvent(event: WebhookEventRecord): Promise<void>;
}
