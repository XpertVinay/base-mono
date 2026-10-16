import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import { TransactionType, TransactionStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionProps {
  referenceId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  provider?: string;
  providerSessionId?: string;
  providerTransactionId?: string;
  redirectUrl?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction extends AggregateRoot<TransactionProps> {
  private constructor(id: string, props: TransactionProps) {
    super(id, props);
  }

  get referenceId(): string { return this.props.referenceId; }
  get userId(): string { return this.props.userId; }
  get type(): TransactionType { return this.props.type; }
  get status(): TransactionStatus { return this.props.status; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get paymentMethod(): string { return this.props.paymentMethod; }
  get provider(): string | undefined { return this.props.provider; }
  get providerSessionId(): string | undefined { return this.props.providerSessionId; }
  get providerTransactionId(): string | undefined { return this.props.providerTransactionId; }
  get redirectUrl(): string | undefined { return this.props.redirectUrl; }
  get failureReason(): string | undefined { return this.props.failureReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public setInitiationDetails(provider: string, providerSessionId: string, redirectUrl: string): void {
    this.props.provider = provider;
    this.props.providerSessionId = providerSessionId;
    this.props.redirectUrl = redirectUrl;
    this.props.paymentMethod = `${provider} (HOSTED_REDIRECT)`;
    this.props.updatedAt = new Date();
  }

  public complete(providerTransactionId?: string): void {
    if (this.props.status !== 'PENDING') {
      throw new Error(`Cannot complete transaction in '${this.props.status}' status`);
    }
    this.props.status = 'SUCCESS';
    if (providerTransactionId) {
      this.props.providerTransactionId = providerTransactionId;
    }
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      id: uuidv4(),
      eventName: 'transactions.completed',
      aggregateId: this.id,
      occurredAt: new Date(),
      version: 1,
      payload: {
        transactionId: this.id,
        referenceId: this.referenceId,
        userId: this.userId,
        status: 'SUCCESS',
        amount: this.amount,
        currency: this.currency
      }
    });
  }

  public fail(reason: string, providerTransactionId?: string): void {
    this.props.status = 'FAILED';
    this.props.failureReason = reason;
    if (providerTransactionId) {
      this.props.providerTransactionId = providerTransactionId;
    }
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      id: uuidv4(),
      eventName: 'transactions.failed',
      aggregateId: this.id,
      occurredAt: new Date(),
      version: 1,
      payload: {
        transactionId: this.id,
        referenceId: this.referenceId,
        userId: this.userId,
        status: 'FAILED',
        amount: this.amount,
        currency: this.currency,
        reason
      }
    });
  }

  public static create(
    referenceId: string,
    userId: string,
    amount: number,
    paymentMethod: string,
    currency = 'USD',
    type: TransactionType = 'PAYMENT',
    id?: string
  ): Transaction {
    if (amount <= 0) throw new Error('Transaction amount must be greater than zero');

    const transactionId = id || uuidv4();
    const now = new Date();

    return new Transaction(transactionId, {
      referenceId,
      userId,
      type,
      status: 'PENDING',
      amount,
      currency,
      paymentMethod,
      createdAt: now,
      updatedAt: now
    });
  }

  public static reconstitute(id: string, props: TransactionProps): Transaction {
    return new Transaction(id, props);
  }
}
