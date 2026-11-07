import crypto from 'crypto';
import { UnitStatus } from '@monolith/contracts';

export class InvalidUnitTransitionError extends Error {
  constructor(from: UnitStatus, to: UnitStatus) {
    super(`Invalid unit status transition from ${from} to ${to}`);
    this.name = 'InvalidUnitTransitionError';
  }
}

export class PropertyUnit {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly unitNumber: string,
    public readonly floor: number,
    private _status: UnitStatus,
    public rentAmount: number,
    public depositAmount: number,
    public areaSqFt: number,
    public readonly createdAt: Date,
    public readonly tenantId?: string
  ) {}

  public static create(
    propertyId: string,
    unitNumber: string,
    rentAmount: number,
    areaSqFt: number,
    options?: {
      floor?: number;
      depositAmount?: number;
      tenantId?: string;
      id?: string;
    }
  ): PropertyUnit {
    if (!unitNumber || unitNumber.trim().length === 0) {
      throw new Error('Unit number is required');
    }
    if (rentAmount < 0) {
      throw new Error('Rent amount cannot be negative');
    }
    if (areaSqFt <= 0) {
      throw new Error('Unit area must be greater than zero');
    }

    return new PropertyUnit(
      options?.id || crypto.randomUUID(),
      propertyId,
      unitNumber.trim(),
      options?.floor ?? 1,
      'VACANT',
      Math.round(rentAmount * 100) / 100,
      Math.max(0, Math.round((options?.depositAmount ?? 0) * 100) / 100),
      areaSqFt,
      new Date(),
      options?.tenantId
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    unitNumber: string;
    floor: number;
    status: UnitStatus;
    rentAmount: number;
    depositAmount: number;
    areaSqFt: number;
    createdAt: Date;
    tenantId?: string;
  }): PropertyUnit {
    return new PropertyUnit(
      props.id,
      props.propertyId,
      props.unitNumber,
      props.floor,
      props.status,
      props.rentAmount,
      props.depositAmount,
      props.areaSqFt,
      props.createdAt,
      props.tenantId
    );
  }

  public get status(): UnitStatus {
    return this._status;
  }

  public updateStatus(newStatus: UnitStatus): void {
    if (this._status === newStatus) return;

    const validTransitions: Record<UnitStatus, UnitStatus[]> = {
      VACANT: ['RESERVED', 'OCCUPIED', 'UNDER_MAINTENANCE'],
      RESERVED: ['OCCUPIED', 'VACANT'],
      OCCUPIED: ['VACANT', 'UNDER_MAINTENANCE'],
      UNDER_MAINTENANCE: ['VACANT', 'OCCUPIED']
    };

    if (!validTransitions[this._status]?.includes(newStatus)) {
      throw new InvalidUnitTransitionError(this._status, newStatus);
    }

    this._status = newStatus;
  }
}
