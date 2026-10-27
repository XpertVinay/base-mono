import crypto from 'crypto';
import { RentalListingStatus } from '@monolith/contracts';

export class RentalListing {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly ownerId: string,
    public monthlyRent: number,
    public securityDeposit: number,
    public leaseDurationMonths: number,
    public availableFrom: Date,
    public permittedUse: 'RESIDENTIAL' | 'COMMERCIAL',
    public description: string,
    private _status: RentalListingStatus,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    propertyId: string,
    ownerId: string,
    monthlyRent: number,
    securityDeposit: number,
    leaseDurationMonths: number = 11,
    availableFrom: Date = new Date(),
    permittedUse: 'RESIDENTIAL' | 'COMMERCIAL' = 'RESIDENTIAL',
    description: string = ''
  ): RentalListing {
    if (monthlyRent <= 0) {
      throw new Error('Monthly rent must be greater than zero');
    }
    if (securityDeposit < 0) {
      throw new Error('Security deposit cannot be negative');
    }
    if (leaseDurationMonths <= 0) {
      throw new Error('Lease duration must be at least 1 month');
    }

    const now = new Date();
    return new RentalListing(
      crypto.randomUUID(),
      propertyId,
      ownerId,
      monthlyRent,
      securityDeposit,
      leaseDurationMonths,
      availableFrom,
      permittedUse,
      description.trim(),
      'DRAFT',
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    ownerId: string;
    monthlyRent: number;
    securityDeposit: number;
    leaseDurationMonths: number;
    availableFrom: Date;
    permittedUse: 'RESIDENTIAL' | 'COMMERCIAL';
    description: string;
    status: RentalListingStatus;
    createdAt: Date;
    updatedAt: Date;
  }): RentalListing {
    return new RentalListing(
      props.id,
      props.propertyId,
      props.ownerId,
      props.monthlyRent,
      props.securityDeposit,
      props.leaseDurationMonths,
      props.availableFrom,
      props.permittedUse,
      props.description,
      props.status,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): RentalListingStatus {
    return this._status;
  }

  public publish(): void {
    if (this._status === 'LEASED') {
      throw new Error('Cannot publish an already leased property listing');
    }
    this._status = 'ACTIVE';
    this.updatedAt = new Date();
  }

  public markLeased(): void {
    this._status = 'LEASED';
    this.updatedAt = new Date();
  }

  public pause(): void {
    this._status = 'PAUSED';
    this.updatedAt = new Date();
  }
}
