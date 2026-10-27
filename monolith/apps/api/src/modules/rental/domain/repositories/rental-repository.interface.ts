import { RentalListing } from '../entities/rental-listing.entity.js';
import { TenantLead } from '../entities/tenant-lead.entity.js';

export interface IRentalRepository {
  // Listings
  saveListing(listing: RentalListing): Promise<void>;
  updateListing(listing: RentalListing): Promise<void>;
  findListingById(id: string): Promise<RentalListing | null>;
  findListingByPropertyId(propertyId: string): Promise<RentalListing | null>;
  findAllActiveListings(): Promise<RentalListing[]>;

  // Leads
  saveLead(lead: TenantLead): Promise<void>;
  updateLead(lead: TenantLead): Promise<void>;
  findLeadById(id: string): Promise<TenantLead | null>;
  findLeadsByListingId(listingId: string): Promise<TenantLead[]>;
  findLeadsByPropertyId(propertyId: string): Promise<TenantLead[]>;
}
