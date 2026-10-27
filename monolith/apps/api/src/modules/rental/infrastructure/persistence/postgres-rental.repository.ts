import { IRentalRepository } from '../../domain/repositories/rental-repository.interface.js';
import { RentalListing } from '../../domain/entities/rental-listing.entity.js';
import { TenantLead } from '../../domain/entities/tenant-lead.entity.js';
import { dbPool } from '../../../../infrastructure/database/connection-pool.js';
import { logger } from '../../../../shared/infrastructure/logger.js';

export class PostgresRentalRepository implements IRentalRepository {
  private listingStore: Map<string, RentalListing> = new Map();
  private leadStore: Map<string, TenantLead> = new Map();

  async saveListing(listing: RentalListing): Promise<void> {
    this.listingStore.set(listing.id, listing);
    try {
      await dbPool.query(
        `INSERT INTO rental.listings (id, property_id, owner_id, monthly_rent, security_deposit, lease_duration_months, available_from, permitted_use, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           monthly_rent = EXCLUDED.monthly_rent,
           security_deposit = EXCLUDED.security_deposit,
           status = EXCLUDED.status,
           updated_at = EXCLUDED.updated_at`,
        [
          listing.id,
          listing.propertyId,
          listing.ownerId,
          listing.monthlyRent,
          listing.securityDeposit,
          listing.leaseDurationMonths,
          listing.availableFrom,
          listing.permittedUse,
          listing.description,
          listing.status,
          listing.createdAt,
          listing.updatedAt
        ]
      );
    } catch {
      logger.warn('Database saveListing failed in PostgresRentalRepository, using fallback store', { listingId: listing.id });
    }
  }

  async updateListing(listing: RentalListing): Promise<void> {
    await this.saveListing(listing);
  }

  async findListingById(id: string): Promise<RentalListing | null> {
    try {
      const res = await dbPool.query('SELECT * FROM rental.listings WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.listingStore.get(id) || null;
      return this.mapListing(res.rows[0]);
    } catch {
      return this.listingStore.get(id) || null;
    }
  }

  async findListingByPropertyId(propertyId: string): Promise<RentalListing | null> {
    try {
      const res = await dbPool.query('SELECT * FROM rental.listings WHERE property_id = $1 LIMIT 1', [propertyId]);
      if (res.rows.length === 0) {
        return Array.from(this.listingStore.values()).find(l => l.propertyId === propertyId) || null;
      }
      return this.mapListing(res.rows[0]);
    } catch {
      return Array.from(this.listingStore.values()).find(l => l.propertyId === propertyId) || null;
    }
  }

  async findAllActiveListings(): Promise<RentalListing[]> {
    try {
      const res = await dbPool.query("SELECT * FROM rental.listings WHERE status = 'ACTIVE' ORDER BY created_at DESC");
      if (res.rows.length === 0) return Array.from(this.listingStore.values()).filter(l => l.status === 'ACTIVE');
      return res.rows.map(this.mapListing);
    } catch {
      return Array.from(this.listingStore.values()).filter(l => l.status === 'ACTIVE');
    }
  }

  async saveLead(lead: TenantLead): Promise<void> {
    this.leadStore.set(lead.id, lead);
    try {
      await dbPool.query(
        `INSERT INTO rental.leads (id, listing_id, property_id, tenant_name, tenant_phone, tenant_email, status, scheduled_visit_date, offered_rent, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           scheduled_visit_date = EXCLUDED.scheduled_visit_date,
           notes = EXCLUDED.notes,
           updated_at = EXCLUDED.updated_at`,
        [
          lead.id,
          lead.listingId,
          lead.propertyId,
          lead.tenantName,
          lead.tenantPhone,
          lead.tenantEmail,
          lead.status,
          lead.scheduledVisitDate,
          lead.offeredRent,
          lead.notes,
          lead.createdAt,
          lead.updatedAt
        ]
      );
    } catch {
      logger.warn('Database saveLead failed in PostgresRentalRepository, using fallback store', { leadId: lead.id });
    }
  }

  async updateLead(lead: TenantLead): Promise<void> {
    await this.saveLead(lead);
  }

  async findLeadById(id: string): Promise<TenantLead | null> {
    try {
      const res = await dbPool.query('SELECT * FROM rental.leads WHERE id = $1', [id]);
      if (res.rows.length === 0) return this.leadStore.get(id) || null;
      return this.mapLead(res.rows[0]);
    } catch {
      return this.leadStore.get(id) || null;
    }
  }

  async findLeadsByListingId(listingId: string): Promise<TenantLead[]> {
    try {
      const res = await dbPool.query('SELECT * FROM rental.leads WHERE listing_id = $1 ORDER BY created_at DESC', [listingId]);
      if (res.rows.length === 0) return Array.from(this.leadStore.values()).filter(l => l.listingId === listingId);
      return res.rows.map(this.mapLead);
    } catch {
      return Array.from(this.leadStore.values()).filter(l => l.listingId === listingId);
    }
  }

  async findLeadsByPropertyId(propertyId: string): Promise<TenantLead[]> {
    try {
      const res = await dbPool.query('SELECT * FROM rental.leads WHERE property_id = $1 ORDER BY created_at DESC', [propertyId]);
      if (res.rows.length === 0) return Array.from(this.leadStore.values()).filter(l => l.propertyId === propertyId);
      return res.rows.map(this.mapLead);
    } catch {
      return Array.from(this.leadStore.values()).filter(l => l.propertyId === propertyId);
    }
  }

  private mapListing(row: any): RentalListing {
    return RentalListing.reconstruct({
      id: row.id,
      propertyId: row.property_id,
      ownerId: row.owner_id,
      monthlyRent: Number(row.monthly_rent),
      securityDeposit: Number(row.security_deposit),
      leaseDurationMonths: Number(row.lease_duration_months),
      availableFrom: new Date(row.available_from),
      permittedUse: row.permitted_use,
      description: row.description || '',
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }

  private mapLead(row: any): TenantLead {
    return TenantLead.reconstruct({
      id: row.id,
      listingId: row.listing_id,
      propertyId: row.property_id,
      tenantName: row.tenant_name,
      tenantPhone: row.tenant_phone,
      tenantEmail: row.tenant_email,
      status: row.status,
      scheduledVisitDate: row.scheduled_visit_date ? new Date(row.scheduled_visit_date) : null,
      offeredRent: row.offered_rent ? Number(row.offered_rent) : null,
      notes: row.notes || '',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    });
  }
}
