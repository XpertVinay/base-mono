import crypto from 'crypto';
import { PropertyCategory, PropertyType, PropertyStatus, AddressDto } from '@monolith/contracts';

export class Property {
  private constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public title: string,
    public description: string,
    public category: PropertyCategory,
    public propertyType: PropertyType,
    private _status: PropertyStatus,
    public address: AddressDto,
    public areaSqFt: number,
    public amenities: string[],
    public emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    },
    public emergencyFloatLimit: number,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    ownerId: string,
    title: string,
    description: string,
    category: PropertyCategory,
    propertyType: PropertyType,
    address: AddressDto,
    areaSqFt: number,
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    },
    amenities: string[] = [],
    emergencyFloatLimit: number = 5000
  ): Property {
    if (!title || title.trim().length < 3) {
      throw new Error('Property title must be at least 3 characters long');
    }
    if (areaSqFt <= 0) {
      throw new Error('Property area must be greater than zero');
    }
    if (!address || !address.city || !address.street) {
      throw new Error('Property address must include at least street and city');
    }
    if (!emergencyContact || !emergencyContact.phone) {
      throw new Error('Property requires a valid emergency contact phone number');
    }

    const now = new Date();
    return new Property(
      crypto.randomUUID(),
      ownerId,
      title.trim(),
      description.trim(),
      category,
      propertyType,
      'VACANT',
      address,
      areaSqFt,
      amenities,
      emergencyContact,
      Math.max(0, emergencyFloatLimit),
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    ownerId: string;
    title: string;
    description: string;
    category: PropertyCategory;
    propertyType: PropertyType;
    status: PropertyStatus;
    address: AddressDto;
    areaSqFt: number;
    amenities: string[];
    emergencyContact: {
      name: string;
      phone: string;
      relationship: string;
    };
    emergencyFloatLimit: number;
    createdAt: Date;
    updatedAt: Date;
  }): Property {
    return new Property(
      props.id,
      props.ownerId,
      props.title,
      props.description,
      props.category,
      props.propertyType,
      props.status,
      props.address,
      props.areaSqFt,
      props.amenities,
      props.emergencyContact,
      props.emergencyFloatLimit,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): PropertyStatus {
    return this._status;
  }

  public updateStatus(newStatus: PropertyStatus, _reason?: string): void {
    if (this._status === newStatus) return;

    // Domain invariant: Validate state transitions
    const validTransitions: Record<PropertyStatus, PropertyStatus[]> = {
      VACANT: ['RENTED', 'UNDER_MAINTENANCE', 'LISTED_FOR_RENT', 'LISTED_FOR_SALE'],
      RENTED: ['VACANT', 'UNDER_MAINTENANCE'],
      UNDER_MAINTENANCE: ['VACANT', 'RENTED'],
      LISTED_FOR_RENT: ['VACANT', 'RENTED', 'UNDER_MAINTENANCE'],
      LISTED_FOR_SALE: ['VACANT', 'RENTED', 'UNDER_MAINTENANCE']
    };

    if (!validTransitions[this._status]?.includes(newStatus)) {
      throw new Error(`Invalid property status transition from ${this._status} to ${newStatus}`);
    }

    this._status = newStatus;
    this.updatedAt = new Date();
  }

  public updateEmergencyFloatLimit(limit: number): void {
    if (limit < 0) {
      throw new Error('Emergency float limit cannot be negative');
    }
    this.emergencyFloatLimit = limit;
    this.updatedAt = new Date();
  }
}
