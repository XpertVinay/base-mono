import { Entity } from '../../shared/domain/entity.js';

export type TransactionType = 'PAYMENT' | 'REFUND' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface TransactionProps {
  tenantId?: string;
  referenceId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  paymentMethod: string;
  failureReason?: string;
  provider?: string;
  providerSessionId?: string;
  providerTransactionId?: string;
  redirectUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Transaction extends Entity<TransactionProps> {
  private constructor(props: TransactionProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<TransactionProps, 'status' | 'createdAt' | 'updatedAt'>,
    id?: string
  ): Transaction {
    return new Transaction(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      id
    );
  }

  public static reconstitute(props: TransactionProps, id: string): Transaction {
    return new Transaction(props, id);
  }

  get tenantId(): string { return this.props.tenantId || 'default'; }
  get referenceId(): string { return this.props.referenceId; }
  get userId(): string { return this.props.userId; }
  get type(): TransactionType { return this.props.type; }
  get status(): TransactionStatus { return this.props.status; }
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get paymentMethod(): string { return this.props.paymentMethod; }
  get failureReason(): string | undefined { return this.props.failureReason; }
  get provider(): string | undefined { return this.props.provider; }
  get providerSessionId(): string | undefined { return this.props.providerSessionId; }
  get providerTransactionId(): string | undefined { return this.props.providerTransactionId; }
  get redirectUrl(): string | undefined { return this.props.redirectUrl; }
  get createdAt(): Date { return this.props.createdAt!; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public setProviderDetails(provider: string, sessionId: string, redirectUrl: string): void {
    this.props.provider = provider;
    this.props.providerSessionId = sessionId;
    this.props.redirectUrl = redirectUrl;
    this.props.updatedAt = new Date();
  }

  public markSuccess(providerTxnId?: string): void {
    this.props.status = 'SUCCESS';
    if (providerTxnId) this.props.providerTransactionId = providerTxnId;
    this.props.updatedAt = new Date();
  }

  public markFailed(reason: string): void {
    this.props.status = 'FAILED';
    this.props.failureReason = reason;
    this.props.updatedAt = new Date();
  }
}
