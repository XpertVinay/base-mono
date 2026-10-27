import crypto from 'crypto';
import { TenantLeadStatus } from '@monolith/contracts';

export class TenantLead {
  private constructor(
    public readonly id: string,
    public readonly listingId: string,
    public readonly propertyId: string,
    public tenantName: string,
    public tenantPhone: string,
    public tenantEmail: string,
    private _status: TenantLeadStatus,
    public scheduledVisitDate: Date | null,
    public offeredRent: number | null,
    public notes: string,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    listingId: string,
    propertyId: string,
    tenantName: string,
    tenantPhone: string,
    tenantEmail: string,
    offeredRent: number | null = null,
    notes: string = ''
  ): TenantLead {
    if (!tenantName || tenantName.trim().length < 2) {
      throw new Error('Tenant name must be at least 2 characters');
    }
    if (!tenantPhone || tenantPhone.trim().length < 6) {
      throw new Error('Valid tenant phone number is required');
    }

    const now = new Date();
    return new TenantLead(
      crypto.randomUUID(),
      listingId,
      propertyId,
      tenantName.trim(),
      tenantPhone.trim(),
      tenantEmail.trim().toLowerCase(),
      'NEW',
      null,
      offeredRent,
      notes.trim(),
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    listingId: string;
    propertyId: string;
    tenantName: string;
    tenantPhone: string;
    tenantEmail: string;
    status: TenantLeadStatus;
    scheduledVisitDate: Date | null;
    offeredRent: number | null;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
  }): TenantLead {
    return new TenantLead(
      props.id,
      props.listingId,
      props.propertyId,
      props.tenantName,
      props.tenantPhone,
      props.tenantEmail,
      props.status,
      props.scheduledVisitDate,
      props.offeredRent,
      props.notes,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): TenantLeadStatus {
    return this._status;
  }

  public updateStatus(newStatus: TenantLeadStatus, scheduledVisitDate?: Date, notes?: string): void {
    if (this._status === 'CONVERTED' && newStatus !== 'CONVERTED') {
      throw new Error('Cannot revert a converted tenancy lead');
    }

    this._status = newStatus;
    if (scheduledVisitDate) this.scheduledVisitDate = scheduledVisitDate;
    if (notes) this.notes = notes;
    this.updatedAt = new Date();
  }
}
