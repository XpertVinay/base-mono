import { OrganizationType, OrganizationStatus } from '@monolith/contracts';

export interface CreateOrganizationProps {
  id: string;
  name: string;
  slug: string;
  type?: OrganizationType;
  status?: OrganizationStatus;
  ownerUserId: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  private _id: string;
  private _name: string;
  private _slug: string;
  private _type: OrganizationType;
  private _status: OrganizationStatus;
  private _ownerUserId: string;
  private _metadata: Record<string, any>;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: CreateOrganizationProps) {
    if (!props.id || props.id.trim() === '') {
      throw new Error('Organization ID cannot be empty');
    }
    if (!props.name || props.name.trim() === '') {
      throw new Error('Organization name cannot be empty');
    }
    if (!props.slug || props.slug.trim() === '') {
      throw new Error('Organization slug cannot be empty');
    }
    if (!props.ownerUserId || props.ownerUserId.trim() === '') {
      throw new Error('Organization ownerUserId cannot be empty');
    }

    this._id = props.id.trim();
    this._name = props.name.trim();
    this._slug = props.slug.toLowerCase().trim();
    this._type = props.type || 'PROPERTY_MANAGEMENT';
    this._status = props.status || 'ACTIVE';
    this._ownerUserId = props.ownerUserId.trim();
    this._metadata = props.metadata || {};
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get slug(): string { return this._slug; }
  get type(): OrganizationType { return this._type; }
  get status(): OrganizationStatus { return this._status; }
  get ownerUserId(): string { return this._ownerUserId; }
  get metadata(): Record<string, any> { return { ...this._metadata }; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  updateProfile(name?: string, type?: OrganizationType, metadata?: Record<string, any>): void {
    if (name !== undefined) {
      if (!name || name.trim() === '') {
        throw new Error('Organization name cannot be empty');
      }
      this._name = name.trim();
    }
    if (type !== undefined) {
      this._type = type;
    }
    if (metadata !== undefined) {
      this._metadata = { ...this._metadata, ...metadata };
    }
    this._updatedAt = new Date();
  }

  updateStatus(newStatus: OrganizationStatus): void {
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  isAccessible(): boolean {
    return this._status === 'ACTIVE';
  }
}

