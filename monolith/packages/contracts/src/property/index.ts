import { DomainIntegrationEvent } from '../common/index.js';

export type PropertyCategory = 'RESIDENTIAL' | 'COMMERCIAL';

export type PropertyType = 
  | 'APARTMENT' 
  | 'VILLA' 
  | 'INDEPENDENT_HOUSE' 
  | 'OFFICE_SPACE' 
  | 'RETAIL_SHOP' 
  | 'WAREHOUSE' 
  | 'LAND_PLOT';

export type PropertyStatus = 
  | 'VACANT' 
  | 'RENTED' 
  | 'UNDER_MAINTENANCE' 
  | 'LISTED_FOR_RENT' 
  | 'LISTED_FOR_SALE';

export type UnitStatus = 
  | 'VACANT' 
  | 'OCCUPIED' 
  | 'UNDER_MAINTENANCE' 
  | 'RESERVED';

export interface AddressDto {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyDto {
  id: string;
  tenantId?: string;
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
  emergencyFloatLimit: number; // In minor units or whole currency (e.g. INR 5000)
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyRequestDto {
  tenantId?: string;
  title: string;
  description: string;
  category: PropertyCategory;
  propertyType: PropertyType;
  address: AddressDto;
  areaSqFt: number;
  amenities?: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  emergencyFloatLimit?: number;
}

export interface UpdatePropertyStatusRequestDto {
  status: PropertyStatus;
  reason?: string;
}

export interface PropertyUnitDto {
  id: string;
  propertyId: string;
  tenantId?: string;
  unitNumber: string;
  floor: number;
  status: UnitStatus;
  rentAmount: number;
  depositAmount: number;
  areaSqFt: number;
  createdAt: string;
}

export interface CreatePropertyUnitRequestDto {
  tenantId?: string;
  unitNumber: string;
  floor?: number;
  rentAmount: number;
  depositAmount?: number;
  areaSqFt: number;
}

export interface UpdateUnitStatusRequestDto {
  status: UnitStatus;
  reason?: string;
}

export interface FloorplanDto {
  id: string;
  propertyId: string;
  tenantId?: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  baseRent: number;
  createdAt: string;
}

export interface CreateFloorplanRequestDto {
  tenantId?: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  baseRent: number;
}

export interface PricingMatrixDto {
  id: string;
  propertyId: string;
  tenantId?: string;
  seasonName: string;
  multiplier: number;
  effectiveFrom: string;
  effectiveTo: string;
  createdAt: string;
}

export interface CreatePricingMatrixRequestDto {
  tenantId?: string;
  seasonName: string;
  multiplier: number;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface OwnershipSplitDto {
  id: string;
  propertyId: string;
  tenantId?: string;
  ownerId: string;
  sharePercentage: number;
  disbursementAccount?: string;
  createdAt: string;
}

export interface SetOwnershipSplitsRequestDto {
  tenantId?: string;
  splits: Array<{
    ownerId: string;
    sharePercentage: number;
    disbursementAccount?: string;
  }>;
}

export interface PropertyCreatedPayload {
  propertyId: string;
  tenantId?: string;
  ownerId: string;
  title: string;
  category: PropertyCategory;
  status: PropertyStatus;
  emergencyFloatLimit: number;
}

export type PropertyCreatedIntegrationEvent = DomainIntegrationEvent<PropertyCreatedPayload>;

export interface PropertyStatusChangedPayload {
  propertyId: string;
  tenantId?: string;
  previousStatus: PropertyStatus;
  newStatus: PropertyStatus;
  updatedBy: string;
  reason?: string;
}

export type PropertyStatusChangedIntegrationEvent = DomainIntegrationEvent<PropertyStatusChangedPayload>;

export interface UnitStatusChangedPayload {
  unitId: string;
  propertyId: string;
  tenantId?: string;
  previousStatus: UnitStatus;
  newStatus: UnitStatus;
  reason?: string;
}

export type UnitStatusChangedIntegrationEvent = DomainIntegrationEvent<UnitStatusChangedPayload>;

export interface OwnershipSplitsUpdatedPayload {
  propertyId: string;
  tenantId?: string;
  splits: Array<{
    ownerId: string;
    sharePercentage: number;
  }>;
}

export type OwnershipSplitsUpdatedIntegrationEvent = DomainIntegrationEvent<OwnershipSplitsUpdatedPayload>;
