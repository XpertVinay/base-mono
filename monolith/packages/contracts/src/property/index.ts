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

export interface PropertyCreatedPayload {
  propertyId: string;
  ownerId: string;
  title: string;
  category: PropertyCategory;
  status: PropertyStatus;
  emergencyFloatLimit: number;
}

export type PropertyCreatedIntegrationEvent = DomainIntegrationEvent<PropertyCreatedPayload>;

export interface PropertyStatusChangedPayload {
  propertyId: string;
  previousStatus: PropertyStatus;
  newStatus: PropertyStatus;
  updatedBy: string;
  reason?: string;
}

export type PropertyStatusChangedIntegrationEvent = DomainIntegrationEvent<PropertyStatusChangedPayload>;
