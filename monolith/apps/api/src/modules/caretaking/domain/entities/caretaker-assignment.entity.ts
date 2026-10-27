import crypto from 'crypto';
import { AssignmentStatus, PermissionScope } from '@monolith/contracts';

export class CaretakerAssignment {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly caretakerId: string,
    public readonly ownerId: string,
    private _status: AssignmentStatus,
    public readonly startDate: Date,
    public endDate: Date | null,
    public monthlyFee: number,
    private _allowedPermissions: Set<PermissionScope>,
    public spendingThresholdLimit: number,
    public acceptedAt: Date | null,
    public terminatedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    propertyId: string,
    caretakerId: string,
    ownerId: string,
    monthlyFee: number,
    allowedPermissions: PermissionScope[] = ['VIEW_PROPERTY', 'INSPECT_PREMISES'],
    spendingThresholdLimit: number = 0,
    startDate: Date = new Date(),
    endDate: Date | null = null
  ): CaretakerAssignment {
    if (monthlyFee < 0) {
      throw new Error('Monthly fee cannot be negative');
    }
    if (spendingThresholdLimit < 0) {
      throw new Error('Spending threshold limit cannot be negative');
    }

    const now = new Date();
    return new CaretakerAssignment(
      crypto.randomUUID(),
      propertyId,
      caretakerId,
      ownerId,
      'PENDING_ACCEPTANCE',
      startDate,
      endDate,
      monthlyFee,
      new Set(allowedPermissions),
      spendingThresholdLimit,
      null,
      null,
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    caretakerId: string;
    ownerId: string;
    status: AssignmentStatus;
    startDate: Date;
    endDate: Date | null;
    monthlyFee: number;
    allowedPermissions: PermissionScope[];
    spendingThresholdLimit: number;
    acceptedAt: Date | null;
    terminatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CaretakerAssignment {
    return new CaretakerAssignment(
      props.id,
      props.propertyId,
      props.caretakerId,
      props.ownerId,
      props.status,
      props.startDate,
      props.endDate,
      props.monthlyFee,
      new Set(props.allowedPermissions),
      props.spendingThresholdLimit,
      props.acceptedAt,
      props.terminatedAt,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): AssignmentStatus {
    return this._status;
  }

  public get allowedPermissions(): PermissionScope[] {
    return Array.from(this._allowedPermissions);
  }

  public accept(_caretakerUserId?: string): void {
    if (this._status !== 'PENDING_ACCEPTANCE') {
      throw new Error(`Cannot accept assignment in ${this._status} status`);
    }
    this._status = 'ACTIVE';
    this.acceptedAt = new Date();
    this.updatedAt = new Date();
  }

  public hasPermission(permission: PermissionScope): boolean {
    if (this._status !== 'ACTIVE') return false;
    return this._allowedPermissions.has(permission);
  }

  public updatePermissions(permissions: PermissionScope[], spendingLimit?: number): void {
    if (this._status === 'TERMINATED') {
      throw new Error('Cannot update permissions on a terminated assignment');
    }
    this._allowedPermissions = new Set(permissions);
    if (spendingLimit !== undefined) {
      if (spendingLimit < 0) throw new Error('Spending threshold limit cannot be negative');
      this.spendingThresholdLimit = spendingLimit;
    }
    this.updatedAt = new Date();
  }

  public terminate(): void {
    if (this._status === 'TERMINATED') return;
    this._status = 'TERMINATED';
    this._allowedPermissions.clear(); // Immediate permission revocation invariant (FR-ASG-010)
    this.terminatedAt = new Date();
    this.updatedAt = new Date();
  }
}
