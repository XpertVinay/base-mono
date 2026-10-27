import { DomainIntegrationEvent } from '../common/index.js';

export type RentalListingStatus = 'DRAFT' | 'ACTIVE' | 'LEASED' | 'PAUSED';

export type TenantLeadStatus = 
  | 'NEW' 
  | 'CONTACTED' 
  | 'QUALIFIED' 
  | 'VISIT_SCHEDULED' 
  | 'NEGOTIATION' 
  | 'DOCUMENTATION' 
  | 'CONVERTED' 
  | 'REJECTED';

export interface RentalListingDto {
  id: string;
  propertyId: string;
  ownerId: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseDurationMonths: number;
  availableFrom: string;
  permittedUse: 'RESIDENTIAL' | 'COMMERCIAL';
  description: string;
  status: RentalListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TenantLeadDto {
  id: string;
  listingId: string;
  propertyId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  status: TenantLeadStatus;
  scheduledVisitDate?: string;
  offeredRent?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRentalListingRequestDto {
  propertyId: string;
  monthlyRent: number;
  securityDeposit: number;
  leaseDurationMonths?: number;
  availableFrom?: string;
  permittedUse?: 'RESIDENTIAL' | 'COMMERCIAL';
  description?: string;
}

export interface CreateTenantLeadRequestDto {
  listingId: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  offeredRent?: number;
  notes?: string;
}

export interface UpdateTenantLeadStatusRequestDto {
  status: TenantLeadStatus;
  scheduledVisitDate?: string;
  notes?: string;
}

export interface RentalListingPublishedPayload {
  listingId: string;
  propertyId: string;
  monthlyRent: number;
}

export type RentalListingPublishedIntegrationEvent = DomainIntegrationEvent<RentalListingPublishedPayload>;

export interface TenantLeadStatusChangedPayload {
  leadId: string;
  listingId: string;
  propertyId: string;
  previousStatus: TenantLeadStatus;
  newStatus: TenantLeadStatus;
}

export type TenantLeadStatusChangedIntegrationEvent = DomainIntegrationEvent<TenantLeadStatusChangedPayload>;
