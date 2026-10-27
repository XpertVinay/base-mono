import crypto from 'crypto';
import { ExpenseType, PaymentStatus } from '@monolith/contracts';

export class ExpenseRecord {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly creatorId: string,
    public payeeName: string,
    public expenseType: ExpenseType,
    public amount: number,
    public description: string,
    public invoiceUrl: string | null,
    private _status: PaymentStatus,
    public approvedBy: string | null,
    public approvedAt: Date | null,
    public settledAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    propertyId: string,
    creatorId: string,
    payeeName: string,
    expenseType: ExpenseType,
    amount: number,
    description: string,
    invoiceUrl: string | null = null
  ): ExpenseRecord {
    if (amount <= 0) {
      throw new Error('Expense amount must be strictly greater than zero');
    }
    if (!payeeName || payeeName.trim().length < 2) {
      throw new Error('Payee name must be at least 2 characters');
    }

    const now = new Date();
    return new ExpenseRecord(
      crypto.randomUUID(),
      propertyId,
      creatorId,
      payeeName.trim(),
      expenseType,
      amount,
      description.trim(),
      invoiceUrl,
      'PENDING_APPROVAL',
      null,
      null,
      null,
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    creatorId: string;
    payeeName: string;
    expenseType: ExpenseType;
    amount: number;
    description: string;
    invoiceUrl: string | null;
    status: PaymentStatus;
    approvedBy: string | null;
    approvedAt: Date | null;
    settledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ExpenseRecord {
    return new ExpenseRecord(
      props.id,
      props.propertyId,
      props.creatorId,
      props.payeeName,
      props.expenseType,
      props.amount,
      props.description,
      props.invoiceUrl,
      props.status,
      props.approvedBy,
      props.approvedAt,
      props.settledAt,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): PaymentStatus {
    return this._status;
  }

  public approve(approvedByActorId: string): void {
    if (this._status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve expense in status ${this._status}`);
    }
    this._status = 'APPROVED';
    this.approvedBy = approvedByActorId;
    this.approvedAt = new Date();
    this.updatedAt = new Date();
  }

  public reject(rejectedByActorId: string): void {
    this._status = 'REJECTED';
    this.approvedBy = rejectedByActorId;
    this.updatedAt = new Date();
  }

  public settle(): void {
    if (this._status !== 'APPROVED') {
      throw new Error('Expense must be explicitly approved before financial settlement');
    }
    this._status = 'SETTLED';
    this.settledAt = new Date();
    this.updatedAt = new Date();
  }
}
